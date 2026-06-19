import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AuthModule } from '../auth/auth.module';

// Shared attachment foundation. Exported so the DM / Channel / Project message
// services can link uploaded attachments to a message on send.
@Module({
  imports: [AuthModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
