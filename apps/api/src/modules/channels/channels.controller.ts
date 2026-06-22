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
import { ChannelsService } from './channels.service';
import {
  CreateChannelDto,
  ChannelMessageDto,
  ChannelEditMessageDto,
  AddMembersDto,
} from './dto/channel.dto';

@ApiTags('channels')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(private channels: ChannelsService) {}

  // --- channel list & discovery (static routes first) -----------------------

  @Get()
  @ApiOperation({ summary: 'List channels you are a member of' })
  async listChannels(@Req() req: any) {
    return this.channels.listChannels(req.userId);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover public channels you have not joined' })
  async discoverChannels(@Req() req: any) {
    return this.channels.listPublicChannels(req.userId);
  }

  // --- per-user inbox SSE stream --------------------------------------------
  // Auth via `?token=` since EventSource cannot set headers.
  @Get('inbox/stream')
  @ApiOperation({ summary: 'Subscribe to channel inbox updates via SSE' })
  async streamInbox(@Req() req: any, @Res() res: Response) {
    this.openSse(res);
    const send = this.sender(res);
    send('ready', { ok: true });

    const unsubscribe = this.channels.subscribeToInbox(
      req.userId,
      (event) => send(event.type, event),
    );
    this.wireHeartbeatAndCleanup(req, res, unsubscribe);
  }

  // --- channel CRUD ----------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create a new channel' })
  async createChannel(@Req() req: any, @Body() dto: CreateChannelDto) {
    return this.channels.createChannel(req.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel details and member list' })
  async getChannel(@Req() req: any, @Param('id') id: string) {
    return this.channels.getChannel(id, req.userId);
  }

  // --- messages -------------------------------------------------------------

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a channel (oldest first)' })
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('after') after?: string,
  ) {
    return this.channels.listMessages(id, req.userId, after);
  }

  // SSE: realtime message create/update/delete inside one channel.
  @Get(':id/stream')
  @ApiOperation({ summary: 'Subscribe to channel message events via SSE' })
  async streamChannel(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    // Verify membership before opening the stream.
    await this.channels.listMessages(id, req.userId);

    this.openSse(res);
    const send = this.sender(res);
    send('ready', { ok: true });

    const unsubscribe = this.channels.subscribeToChannel(
      id,
      (event) => send(event.type, event),
    );
    this.wireHeartbeatAndCleanup(req, res, unsubscribe);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message to a channel' })
  async addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ChannelMessageDto,
  ) {
    return this.channels.addMessage(
      id,
      req.userId,
      dto.body ?? '',
      dto.attachmentIds,
      { originalBody: dto.originalBody, originalLang: dto.originalLang },
    );
  }

  @Patch(':id/messages/:messageId')
  @ApiOperation({ summary: 'Edit your own channel message' })
  async updateMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: ChannelEditMessageDto,
  ) {
    return this.channels.updateMessage(id, messageId, req.userId, dto.body);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete your own channel message' })
  async deleteMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    await this.channels.deleteMessage(id, messageId, req.userId);
  }

  // --- membership actions ---------------------------------------------------

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a channel as read up to now' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    return this.channels.markRead(id, req.userId);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a public channel' })
  async joinChannel(@Req() req: any, @Param('id') id: string) {
    return this.channels.joinChannel(id, req.userId);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a channel' })
  async leaveChannel(@Req() req: any, @Param('id') id: string) {
    return this.channels.leaveChannel(id, req.userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add members to a channel (members only)' })
  async addMembers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.channels.addMembers(id, req.userId, dto.userIds);
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
