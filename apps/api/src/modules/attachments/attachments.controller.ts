import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AttachmentsService } from './attachments.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
@UseGuards(AuthGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('presign-upload')
  @ApiOperation({ summary: 'Create a pending attachment + presigned PUT URL' })
  async presignUpload(@Req() req: any, @Body() dto: PresignUploadDto) {
    return this.attachments.presignUpload(req.userId, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Verify a pending upload landed in storage' })
  async confirm(@Req() req: any, @Param('id') id: string) {
    return this.attachments.confirmUpload(id, req.userId);
  }

  @Post(':id/transcribe')
  @ApiOperation({
    summary: 'Transcribe a pending audio attachment via OpenAI Whisper',
  })
  async transcribe(@Req() req: any, @Param('id') id: string) {
    return this.attachments.transcribe(id, req.userId);
  }

  @Get(':id/url')
  @ApiOperation({
    summary: 'Get a short-lived presigned GET URL (membership-gated)',
  })
  async getUrl(@Req() req: any, @Param('id') id: string) {
    return this.attachments.getDownloadUrl(id, req.userId);
  }
}
