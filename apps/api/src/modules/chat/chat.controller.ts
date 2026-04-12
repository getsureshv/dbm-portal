import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';
import { Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface ScopeMessage {
  message: string;
}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('scope/:projectId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary:
      'Send message to AI Scope Architect for scope document interview',
  })
  async scopeArchitect(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: ScopeMessage,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req as any).userId;
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (!projectId) {
      throw new HttpException(
        'projectId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!body.message) {
      throw new HttpException(
        'message is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      await this.chatService.streamScopeArchitectResponse(
        userId,
        projectId,
        body.message,
        res,
      );
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: error.message || 'Failed to process scope architecture request',
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: error.message || 'Failed to process scope architecture request',
          })}\n\n`,
        );
      }
      res.end();
    }
  }

  @Get('conversations')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'List user chat conversations',
  })
  async listConversations(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    const userId = (req as any).userId;
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const pageLimit = Math.min(limit ? Math.max(1, limit) : 20, 100);

    return this.chatService.listUserConversations({
      userId,
      cursor,
      limit: pageLimit,
    });
  }
}
