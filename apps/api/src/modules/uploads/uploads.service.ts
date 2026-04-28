import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface GeneratePresignedUrlParams {
  userId: string;
  kind: 'portfolio' | 'profileImage' | 'scopeDoc' | 'insuranceCert';
  contentType: string;
  contentLength: number;
}

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private endpoint: string | undefined;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'dbm-portal';
    this.endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    const s3Config: any = {
      region: this.configService.get<string>('AWS_S3_REGION') || this.configService.get<string>('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('AWS_S3_ACCESS_KEY_ID') || this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_S3_SECRET_ACCESS_KEY') || this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
      // Opt out of SDK 3.730+ default checksum headers — they break browser presigned PUT
      // because the headers get included in SignedHeaders but browsers can't send them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };

    // Use custom endpoint if provided (for local minio or other S3-compatible services)
    if (this.endpoint) {
      s3Config.endpoint = this.endpoint;
      s3Config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(s3Config);
  }

  async generatePresignedUrl(
    params: GeneratePresignedUrlParams,
  ): Promise<{
    uploadUrl: string;
    key: string;
    expiresAt: Date;
  }> {
    const { userId, kind, contentType, contentLength } = params;

    // Generate object key with structure: uploads/{kind}/{userId}/{timestamp}-{random}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = this.getFileExtension(contentType);
    const key = `uploads/${kind}/${userId}/${timestamp}-${random}${extension}`;

    // Create S3 PUT object command
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    } as PutObjectCommandInput);

    // Generate presigned URL valid for 1 hour (3600 seconds)
    const expiresInSeconds = 3600;
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      uploadUrl,
      key,
      expiresAt,
    };
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    } as PutObjectCommandInput);

    await this.s3Client.send(command);
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    // Convert the readable stream to a Buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    const body = Buffer.concat(chunks);

    return {
      body,
      contentType: response.ContentType || 'application/octet-stream',
    };
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  private getFileExtension(contentType: string): string {
    const extensionMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
    };
    return extensionMap[contentType] || '';
  }
}
