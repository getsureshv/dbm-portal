import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../common/prisma.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed image MIME types for increment 1, mapped to the file extension used
// in the generated S3 key.
const IMAGE_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB

// Short-lived presigned URL lifetimes. Uploads need only a few minutes; reads
// are slightly longer so an open lightbox doesn't expire mid-view.
const PUT_EXPIRES_SECONDS = 5 * 60;
const GET_EXPIRES_SECONDS = 10 * 60;

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('S3_BUCKET') || 'dbm-portal-uploads';

    // Cloudflare R2 (S3-compatible) requires region 'auto' + path-style. The
    // checksum opt-out matches the existing uploads service: SDK 3.730+ adds
    // checksum headers that break browser presigned PUTs (the header lands in
    // SignedHeaders but the browser cannot reproduce it).
    this.s3 = new S3Client({
      endpoint: this.config.get<string>('AWS_S3_ENDPOINT'),
      region: 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    } as any);
  }

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // ── Presign upload ─────────────────────────────────────────────────────────
  // Validates the request, creates a pending Attachment row, and returns a
  // short-lived presigned PUT URL the browser uploads to directly.
  async presignUpload(uploaderId: string, dto: PresignUploadDto) {
    if (dto.kind !== 'image') {
      throw new BadRequestException(
        `Only image attachments are supported right now (got "${dto.kind}").`,
      );
    }

    const ext = IMAGE_MIME_EXT[dto.mime];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported image type "${dto.mime}". Allowed: ${Object.keys(
          IMAGE_MIME_EXT,
        ).join(', ')}.`,
      );
    }

    if (dto.sizeBytes > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Image is too large (${(dto.sizeBytes / (1024 * 1024)).toFixed(
          1,
        )}MB). Maximum is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`,
      );
    }

    const s3Key = `attachments/${uploaderId}/${randomUUID()}.${ext}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId,
        kind: 'image',
        s3Key,
        mime: dto.mime,
        sizeBytes: dto.sizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
      },
    });

    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(
        this.s3,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          ContentType: dto.mime,
        }),
        { expiresIn: PUT_EXPIRES_SECONDS },
      );
    } catch (err) {
      // Surface the real R2 error in logs; the client gets a friendly message.
      this.logger.error(
        `Failed to presign PUT for key ${s3Key}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new BadRequestException(
        'Could not start the upload. Please try again.',
      );
    }

    return {
      attachmentId: attachment.id,
      uploadUrl,
      s3Key,
      expiresInSeconds: PUT_EXPIRES_SECONDS,
    };
  }

  // ── Confirm upload ───────────────────────────────────────────────────────
  // Optional verification step: HEAD the object to confirm the bytes landed.
  // Only the uploader may confirm, and only while the attachment is still
  // pending. Returns the stored size reported by R2.
  async confirmUpload(attachmentId: string, userId: string) {
    const attachment = await this.getOwnPendingOrThrow(attachmentId, userId);

    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: attachment.s3Key }),
      );
      return {
        attachmentId: attachment.id,
        confirmed: true,
        sizeBytes: head.ContentLength ?? attachment.sizeBytes,
      };
    } catch (err) {
      this.logger.error(
        `HeadObject failed for key ${attachment.s3Key}: ${
          (err as Error).message
        }`,
        (err as Error).stack,
      );
      throw new BadRequestException(
        'Upload could not be verified. Please try uploading again.',
      );
    }
  }

  // ── Pre-signed GET URL (membership-gated) ──────────────────────────────────
  async getDownloadUrl(attachmentId: string, userId: string) {
    this.validateUuid(attachmentId);
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    await this.assertCanAccess(attachment, userId);

    let url: string;
    try {
      url = await getSignedUrl(
        this.s3,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: attachment.s3Key,
        }),
        { expiresIn: GET_EXPIRES_SECONDS },
      );
    } catch (err) {
      this.logger.error(
        `Failed to presign GET for key ${attachment.s3Key}: ${
          (err as Error).message
        }`,
        (err as Error).stack,
      );
      throw new BadRequestException(
        'Could not load this image. Please try again.',
      );
    }

    return { url, expiresInSeconds: GET_EXPIRES_SECONDS };
  }

  // ── Access control ─────────────────────────────────────────────────────────
  // The single source of truth for "may this user see this object". Pending
  // attachments (not yet linked to a sent message) are uploader-only. Linked
  // attachments require membership of the conversation the message belongs to.
  private async assertCanAccess(
    attachment: {
      uploaderId: string;
      directMessageId: string | null;
      channelMessageId: string | null;
      projectMessageId: string | null;
    },
    userId: string,
  ) {
    const isPending =
      !attachment.directMessageId &&
      !attachment.channelMessageId &&
      !attachment.projectMessageId;

    if (isPending) {
      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException('Not authorized to access this attachment');
      }
      return;
    }

    let member = false;
    if (attachment.directMessageId) {
      member = await this.isDirectMessageMember(
        attachment.directMessageId,
        userId,
      );
    } else if (attachment.channelMessageId) {
      member = await this.isChannelMessageMember(
        attachment.channelMessageId,
        userId,
      );
    } else if (attachment.projectMessageId) {
      member = await this.isProjectMessageMember(
        attachment.projectMessageId,
        userId,
      );
    }

    if (!member) {
      throw new ForbiddenException('Not authorized to access this attachment');
    }
  }

  private async isDirectMessageMember(messageId: string, userId: string) {
    const msg = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      select: { thread: { select: { userAId: true, userBId: true } } },
    });
    if (!msg) return false;
    return msg.thread.userAId === userId || msg.thread.userBId === userId;
  }

  private async isChannelMessageMember(messageId: string, userId: string) {
    const msg = await this.prisma.channelMessage.findUnique({
      where: { id: messageId },
      select: { channelId: true },
    });
    if (!msg) return false;
    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: msg.channelId, userId } },
      select: { id: true },
    });
    return !!membership;
  }

  private async isProjectMessageMember(messageId: string, userId: string) {
    const msg = await this.prisma.projectMessage.findUnique({
      where: { id: messageId },
      select: { project: { select: { id: true, ownerId: true } } },
    });
    if (!msg) return false;
    // Mirror project chat read-access: owner today; participation model later.
    // Kept aligned with ProjectsService.getProject('read').
    return msg.project.ownerId === userId;
  }

  // ── Link helper (used by message-send across all 3 surfaces) ────────────────
  // Validates that every id belongs to `uploaderId` and is still pending, then
  // links them to the given message column inside a transaction. Returns the
  // linked attachment rows (ordered by creation) for inclusion in the response.
  async linkToMessage(
    attachmentIds: string[],
    uploaderId: string,
    target:
      | { directMessageId: string }
      | { channelMessageId: string }
      | { projectMessageId: string },
  ) {
    if (!attachmentIds || attachmentIds.length === 0) return [];

    const unique = [...new Set(attachmentIds)];
    for (const id of unique) this.validateUuid(id);

    const rows = await this.prisma.attachment.findMany({
      where: { id: { in: unique } },
    });

    if (rows.length !== unique.length) {
      throw new BadRequestException('One or more attachments were not found.');
    }
    for (const row of rows) {
      if (row.uploaderId !== uploaderId) {
        throw new ForbiddenException(
          'You can only attach files you uploaded.',
        );
      }
      const alreadyLinked =
        row.directMessageId || row.channelMessageId || row.projectMessageId;
      if (alreadyLinked) {
        throw new BadRequestException(
          'One or more attachments are already attached to a message.',
        );
      }
    }

    await this.prisma.attachment.updateMany({
      where: { id: { in: unique } },
      data: target,
    });

    return this.prisma.attachment.findMany({
      where: { id: { in: unique } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Public shape returned to clients for a message's attachments. Never includes
  // the raw object URL — clients fetch a short-lived GET URL on demand.
  toPublic(a: {
    id: string;
    kind: string;
    mime: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      kind: a.kind,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      createdAt: a.createdAt,
    };
  }

  private async getOwnPendingOrThrow(attachmentId: string, userId: string) {
    this.validateUuid(attachmentId);
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId) {
      throw new ForbiddenException('Not authorized to access this attachment');
    }
    const linked =
      attachment.directMessageId ||
      attachment.channelMessageId ||
      attachment.projectMessageId;
    if (linked) {
      throw new BadRequestException(
        'Attachment is already attached to a message.',
      );
    }
    return attachment;
  }
}
