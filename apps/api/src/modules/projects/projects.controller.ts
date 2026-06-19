import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { ProjectsService } from './projects.service';
import { ScopePdfService } from './scope-pdf.service';
import { PermissionsService } from '../access/permissions.service';
import { RecordGrantsService } from '../access/record-grants.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { GrantProjectAccessDto } from './dto/grant-project-access.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateMessageDto, EditMessageDto } from './dto/create-message.dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private scopePdfService: ScopePdfService,
    private permissions: PermissionsService,
    private grants: RecordGrantsService,
  ) {}

  @Post()
  @RequirePermission('create', 'project')
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @Req() req: any,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    const userId = req.userId;
    return this.projectsService.createProject(userId, createProjectDto);
  }

  @Get()
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: "List caller's projects" })
  async listProjects(@Req() req: any) {
    const userId = req.userId;
    // FR-16: list is scoped by the access engine (admin sees all, client sees
    // own, plus any granted records). The :id-less route has no record, so the
    // PermissionGuard only checks the action match here; the actual row
    // filtering happens in the service via scopeFilter.
    const scope = await this.permissions.scopeFilter(userId, 'read', 'project');
    return this.projectsService.listProjectsScoped(userId, scope);
  }

  @Get('opportunities')
  @ApiOperation({ summary: 'List available projects for providers to browse' })
  async listOpportunities(
    @Query('type') type?: string,
    @Query('zipCode') zipCode?: string,
  ) {
    return this.projectsService.listOpportunities({ type, zipCode });
  }

  @Get('opportunities/:id')
  @ApiOperation({ summary: 'Get a single opportunity detail (provider view)' })
  async getOpportunity(@Param('id') id: string) {
    return this.projectsService.getOpportunity(id);
  }

  @Post(':id/scope/generate-pdf')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Generate a Scope of Work PDF and upload to S3' })
  async generateScopePdf(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.scopePdfService.generatePdf(id, userId);
  }

  @Get(':id/scope/pdf')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: 'Download the generated Scope of Work PDF' })
  async downloadScopePdf(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const userId = req.userId;
    const { buffer, filename } = await this.scopePdfService.getPdf(id, userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: 'Get project by ID with documents and scopeDocument' })
  async getProject(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.projectsService.getProject(id, userId);
  }

  @Get(':id/notes')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: 'List notes/comments on a project (newest first)' })
  async listNotes(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    return this.projectsService.listNotes(id, userId);
  }

  @Post(':id/notes')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Add a note/comment to a project' })
  async addNote(
    @Req() req: any,
    @Param('id') id: string,
    @Body() createNoteDto: CreateNoteDto,
  ) {
    const userId = req.userId;
    return this.projectsService.addNote(id, userId, createNoteDto.body);
  }

  @Patch(':id/notes/:noteId')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: "Edit one of the caller's own notes" })
  async updateNote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() createNoteDto: CreateNoteDto,
  ) {
    const userId = req.userId;
    return this.projectsService.updateNote(id, noteId, userId, createNoteDto.body);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(204)
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: "Delete one of the caller's own notes" })
  async deleteNote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    const userId = req.userId;
    await this.projectsService.deleteNote(id, noteId, userId);
  }

  // ── Chat / messages ──────────────────────────────────────────────────────

  @Get(':id/messages')
  @RequirePermission('read', 'project')
  @ApiOperation({
    summary: 'List a project chat thread (oldest first; ?after=<id> for new)',
  })
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('after') after?: string,
  ) {
    const userId = req.userId;
    return this.projectsService.listMessages(id, userId, after);
  }

  // Realtime chat via Server-Sent Events. The browser EventSource cannot set an
  // Authorization header, so auth comes from a `?token=<jwt>` query param which
  // the AuthGuard now also accepts; the PermissionGuard still enforces read
  // access on this specific project record. We keep the connection open and
  // push `created` / `updated` / `deleted` events as messages change, plus a
  // periodic heartbeat comment so proxies don't time out the idle stream.
  @Get(':id/messages/stream')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: 'Subscribe to a project chat thread via SSE' })
  async streamMessages(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Flush headers immediately so the client's EventSource opens right away.
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Tell the client we're live; it can clear any "connecting" state.
    send('ready', { ok: true });

    const unsubscribe = this.projectsService.subscribeToChat(id, (chatEvent) => {
      send(chatEvent.type, chatEvent);
    });

    // Heartbeat comment every 25s keeps the connection alive through proxies
    // (Render / *.pplx.app) that drop idle streams. Comments start with ':'.
    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on('close', cleanup);
    res.on('error', cleanup);
  }

  @Post(':id/messages')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Post a message to a project chat' })
  async addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const userId = req.userId;
    return this.projectsService.addMessage(
      id,
      userId,
      dto.body ?? '',
      dto.attachmentIds,
    );
  }

  @Patch(':id/messages/:messageId')
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: "Edit one of the caller's own messages" })
  async updateMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    const userId = req.userId;
    return this.projectsService.updateMessage(id, messageId, userId, dto.body);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  @RequirePermission('read', 'project')
  @ApiOperation({ summary: "Delete one of the caller's own messages" })
  async deleteMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.userId;
    await this.projectsService.deleteMessage(id, messageId, userId);
  }

  @Patch(':id')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Update mutable project fields' })
  async updateProject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const userId = req.userId;
    return this.projectsService.updateProject(id, userId, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('delete', 'project')
  @ApiOperation({ summary: 'Soft delete a project' })
  async deleteProject(@Req() req: any, @Param('id') id: string) {
    const userId = req.userId;
    await this.projectsService.deleteProject(id, userId);
  }

  // ── Owner self-service access sharing ───────────────────────────────────
  // An owner can share THEIR OWN project with another user. These routes are
  // gated by `update`@`project` with the record id, so the PermissionGuard
  // confirms (record-level, scope OWN) that the caller actually owns/can-update
  // this specific project before any grant is issued — no admin role required,
  // and an owner can never touch a project they don't own (guard 404s).

  @Get(':id/grants')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'List the access grants on a project you own' })
  async listProjectGrants(@Param('id') id: string) {
    return this.grants.listOwnerGrants(id);
  }

  @Post(':id/grants')
  @RequirePermission('update', 'project')
  @ApiOperation({
    summary: 'Grant another user read/update access to a project you own',
  })
  async grantProjectAccess(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: GrantProjectAccessDto,
  ) {
    return this.grants.ownerGrant({
      recordId: id,
      granteeEmail: dto.email,
      actions: dto.actions,
      reason: dto.reason,
      expiresAt: dto.expiresAt ?? null,
      grantedBy: req.userId,
    });
  }

  @Post(':id/grants/:grantId/revoke')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Revoke an access grant on a project you own' })
  async revokeProjectAccess(
    @Req() req: any,
    @Param('id') id: string,
    @Param('grantId') grantId: string,
  ) {
    return this.grants.ownerRevoke(id, grantId, req.userId);
  }

  @Post(':id/documents')
  @RequirePermission('update', 'project')
  @ApiOperation({ summary: 'Record a document upload' })
  async addDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      s3Key: string;
      filename: string;
      category: string;
    },
  ) {
    const userId = req.userId;

    if (!body.s3Key || !body.filename || !body.category) {
      throw new BadRequestException(
        's3Key, filename, and category are required',
      );
    }

    return this.projectsService.addDocument(
      id,
      userId,
      body.s3Key,
      body.filename,
      body.category,
    );
  }
}
