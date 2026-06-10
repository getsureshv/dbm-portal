import {
  Controller,
  Post,
  Get,
  Delete,
  HttpCode,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post(':id/scan')
  @RequirePermission('update', 'document')
  @ApiOperation({ summary: 'Scan a document using AI to extract text content' })
  async scanDocument(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.documentsService.scanDocument(id, userId);
  }

  @Get(':id/text')
  @RequirePermission('read', 'document')
  @ApiOperation({ summary: 'Get previously extracted text for a document' })
  async getDocumentText(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.documentsService.getDocumentText(id, userId);
  }

  @Post(':id/convert-to-scope')
  @RequirePermission('update', 'document')
  @ApiOperation({
    summary:
      'Use AI Scope Architect to convert a scanned document into the project scope',
  })
  async convertToScope(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.documentsService.convertToScope(id, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('delete', 'document')
  @ApiOperation({ summary: 'Delete a project document and its S3 object' })
  async deleteDocument(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    await this.documentsService.deleteDocument(id, userId);
  }
}
