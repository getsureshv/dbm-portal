import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { DmService } from './dm.service';
import { DmMessageDto, StartThreadDto } from './dto/dm-message.dto';

@ApiTags('direct-messages')
@ApiBearerAuth()
@Controller('dm')
@UseGuards(AuthGuard)
export class DmController {
  constructor(private dm: DmService) {}

  // --- directory & thread list ---------------------------------------------

  @Get('directory')
  @ApiOperation({ summary: 'List users you can message' })
  async directory(@Req() req: any, @Query('search') search?: string) {
    return this.dm.listDirectory(req.userId, search);
  }

  @Get('threads')
  @ApiOperation({ summary: 'List your direct-message conversations' })
  async threads(@Req() req: any) {
    return this.dm.listThreads(req.userId);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Start or open a 1:1 conversation with a user' })
  async startThread(@Req() req: any, @Body() dto: StartThreadDto) {
    return this.dm.getOrCreateThread(req.userId, dto.userId);
  }

  // --- inbox realtime stream (conversation-list updates) --------------------
  // SSE: pushes a lightweight ping whenever any of the caller's threads change,
  // so the sidebar can re-sort and refresh unread badges live. Auth via the
  // `?token=` query param since EventSource cannot set headers.
  @Get('inbox/stream')
  @ApiOperation({ summary: 'Subscribe to conversation-list updates via SSE' })
  async streamInbox(@Req() req: any, @Res() res: Response) {
    this.openSse(res);
    const send = this.sender(res);
    send('ready', { ok: true });

    const unsubscribe = this.dm.subscribeToInbox(req.userId, (event) =>
      send(event.type, event),
    );
    this.wireHeartbeatAndCleanup(req, res, unsubscribe);
  }

  // --- per-thread messages --------------------------------------------------

  @Get('threads/:threadId/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  async listMessages(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Query('after') after?: string,
  ) {
    return this.dm.listMessages(threadId, req.userId, after);
  }

  // SSE: realtime message create/update/delete inside one conversation.
  @Get('threads/:threadId/stream')
  @ApiOperation({ summary: 'Subscribe to a conversation via SSE' })
  async streamThread(
    @Req() req: any,
    @Res() res: Response,
    @Param('threadId') threadId: string,
  ) {
    // Verify the caller is a participant before opening the stream. listMessages
    // performs the same participant check and throws 404 otherwise.
    await this.dm.listMessages(threadId, req.userId);

    this.openSse(res);
    const send = this.sender(res);
    send('ready', { ok: true });

    const unsubscribe = this.dm.subscribeToThread(threadId, (event) =>
      send(event.type, event),
    );
    this.wireHeartbeatAndCleanup(req, res, unsubscribe);
  }

  @Post('threads/:threadId/messages')
  @ApiOperation({ summary: 'Send a direct message' })
  async addMessage(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Body() dto: DmMessageDto,
  ) {
    return this.dm.addMessage(threadId, req.userId, dto.body);
  }

  @Patch('threads/:threadId/messages/:messageId')
  @ApiOperation({ summary: 'Edit your own direct message' })
  async updateMessage(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Param('messageId') messageId: string,
    @Body() dto: DmMessageDto,
  ) {
    return this.dm.updateMessage(threadId, messageId, req.userId, dto.body);
  }

  @Delete('threads/:threadId/messages/:messageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete your own direct message' })
  async deleteMessage(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Param('messageId') messageId: string,
  ) {
    await this.dm.deleteMessage(threadId, messageId, req.userId);
  }

  @Post('threads/:threadId/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  async markRead(@Req() req: any, @Param('threadId') threadId: string) {
    return this.dm.markRead(threadId, req.userId);
  }

  // --- SSE helpers ----------------------------------------------------------

  private openSse(res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
  }

  private sender(res: Response) {
    return (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
  }

  private wireHeartbeatAndCleanup(
    req: any,
    res: Response,
    unsubscribe: () => void,
  ) {
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
}
