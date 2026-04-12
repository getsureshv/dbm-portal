import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
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
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
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

  private getFileExtension(contentType: string): string {
    const extensionMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
    };
    return extensionMap[contentType] || '';
  }
}
