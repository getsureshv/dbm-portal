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
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, ConvertMessageToTaskDto } from './dto/task.dto';
import { TaskStatus } from '@prisma/client';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  // GET /tasks — list tasks for the current user.
  @Get()
  @ApiOperation({ summary: 'List tasks for the current user' })
  async listTasks(
    @Req() req: any,
    @Query('status') status?: TaskStatus,
    @Query('assigneeId') assigneeId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.tasks.listTasks(req.userId, { status, assigneeId, projectId });
  }

  // GET /tasks/counts — MUST be declared before ':id'.
  @Get('counts')
  @ApiOperation({ summary: 'Get unread/overdue task counts for the current user' })
  async getCounts(@Req() req: any) {
    return this.tasks.getUnreadCounts(req.userId);
  }

  // GET /tasks/stream — SSE per-user task board updates. MUST be declared before ':id'.
  // Auth via ?token= since EventSource cannot set headers.
  @Get('stream')
  @ApiOperation({ summary: 'Subscribe to task board updates via SSE' })
  async stream(@Req() req: any, @Res() res: Response) {
    this.openSse(res);
    const send = this.sender(res);
    send('ready', { ok: true });

    const unsubscribe = this.tasks.subscribeToTasks(req.userId, (event) =>
      send(event.type, event),
    );
    this.wireHeartbeatAndCleanup(req, res, unsubscribe);
  }

  // GET /tasks/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a single task' })
  async getTask(@Req() req: any, @Param('id') id: string) {
    return this.tasks.getTask(id, req.userId);
  }

  // POST /tasks — create a new task.
  @Post()
  @ApiOperation({ summary: 'Create a task' })
  async createTask(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasks.createTask(req.userId, dto);
  }

  // POST /tasks/convert — create a task from a message. Static POST, no conflict with ':id'.
  @Post('convert')
  @ApiOperation({ summary: 'Convert a message into a task' })
  async convertMessageToTask(@Req() req: any, @Body() dto: ConvertMessageToTaskDto) {
    return this.tasks.convertMessageToTask(req.userId, dto);
  }

  // PATCH /tasks/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async updateTask(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.updateTask(id, req.userId, dto);
  }

  // POST /tasks/:id/complete — mark the current user's part done.
  // Body { done?: boolean } — pass { done: false } to undo.
  @Post(':id/complete')
  @ApiOperation({ summary: "Mark the current user's part of a task done" })
  async completePart(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { done?: boolean },
  ) {
    const done = body?.done !== false;
    return this.tasks.setAssignmentCompletion(id, req.userId, done);
  }

  // POST /tasks/:id/uncomplete — explicit undo of the current user's part.
  @Post(':id/uncomplete')
  @ApiOperation({ summary: "Undo the current user's part of a task" })
  async uncompletePart(@Req() req: any, @Param('id') id: string) {
    return this.tasks.setAssignmentCompletion(id, req.userId, false);
  }

  // POST /tasks/:id/force-complete — creator-only force the whole task done.
  @Post(':id/force-complete')
  @ApiOperation({ summary: 'Force-complete a task (creator only)' })
  async forceComplete(@Req() req: any, @Param('id') id: string) {
    return this.tasks.forceComplete(id, req.userId);
  }

  // DELETE /tasks/:id
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a task' })
  async deleteTask(@Req() req: any, @Param('id') id: string) {
    await this.tasks.deleteTask(id, req.userId);
  }

  // --- SSE helpers ------------------------------------------------------------

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
