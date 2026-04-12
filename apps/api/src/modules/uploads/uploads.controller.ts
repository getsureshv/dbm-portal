import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { AuthGuard } from '../auth/auth.guard';

export interface PresignRequest {
  kind: 'portfolio' | 'profileImage' | 'scopeDoc' | 'insuranceCert';
  contentType: string;
  contentLength: number;
}

export interface PresignResponse {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary:
      'Get presigned S3 URL for uploading portfolio, profile image, scope doc, or insurance certificate',
  })
  async getPresignedUrl(
    @Req() req: any,
    @Body() body: PresignRequest,
  ): Promise<PresignResponse> {
    const userId = (req as any).userId;
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const { kind, contentType, contentLength } = body;

    // Validate kind parameter
    const validKinds = ['portfolio', 'profileImage', 'scopeDoc', 'insuranceCert'];
    if (!validKinds.includes(kind)) {
      throw new HttpException(
        `kind must be one of: ${validKinds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate content type
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(contentType)) {
      throw new HttpException(
        'contentType must be one of: application/pdf, image/jpeg, image/png',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate content length based on kind
    const isDocument = ['scopeDoc', 'insuranceCert', 'portfolio'].includes(kind);
    const maxSize = isDocument ? 25 * 1024 * 1024 : 5 * 1024 * 1024; // 25MB for docs, 5MB for images

    if (contentLength > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      throw new HttpException(
        `File size exceeds ${maxSizeMB}MB limit for ${kind}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate mime type matches kind
    if (kind === 'profileImage' && !['image/jpeg', 'image/png'].includes(contentType)) {
      throw new HttpException(
        'profileImage must be JPEG or PNG',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      ['scopeDoc', 'insuranceCert'].includes(kind) &&
      contentType !== 'application/pdf'
    ) {
      throw new HttpException(
        `${kind} must be PDF`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      kind === 'portfolio' &&
      !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType)
    ) {
      throw new HttpException(
        'portfolio must be PDF, JPEG, or PNG',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.uploadsService.generatePresignedUrl({
      userId,
      kind,
      contentType,
      contentLength,
    });
  }
}
