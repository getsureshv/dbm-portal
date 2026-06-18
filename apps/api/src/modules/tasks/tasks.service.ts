import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CreateTaskDto, UpdateTaskDto, ConvertMessageToTaskDto } from './dto/task.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TasksChangedEvent = { type: 'tasks-changed' };

type Subscriber<T> = (event: T) => void;

// Shared include shape for consistent responses.
const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true } },
} as const;

export interface ListTasksFilters {
  status?: TaskStatus;
  assigneeId?: string;
  projectId?: string;
  mine?: boolean;
  scope?: string;
}

@Injectable()
export class TasksService {
  // Per-user task board pub/sub channel.
  private taskSubscribers = new Map<string, Set<Subscriber<TasksChangedEvent>>>();

  constructor(private prisma: PrismaService) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // ---- pub/sub ---------------------------------------------------------------

  subscribeToTasks(userId: string, cb: Subscriber<TasksChangedEvent>): () => void {
    let set = this.taskSubscribers.get(userId);
    if (!set) {
      set = new Set();
      this.taskSubscribers.set(userId, set);
    }
    set.add(cb);
    return () => {
      const current = this.taskSubscribers.get(userId);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.taskSubscribers.delete(userId);
    };
  }

  private publish(userId: string, event: TasksChangedEvent) {
    const set = this.taskSubscribers.get(userId);
    if (!set || set.size === 0) return;
    for (const subscriber of set) {
      try {
        subscriber(event);
      } catch {
        // ignore broken subscriber; cleaned up on disconnect
      }
    }
  }

  private publishToRelevantUsers(task: { createdById: string; assigneeId?: string | null }) {
    const event: TasksChangedEvent = { type: 'tasks-changed' };
    this.publish(task.createdById, event);
    if (task.assigneeId && task.assigneeId !== task.createdById) {
      this.publish(task.assigneeId, event);
    }
  }

  // ---- queries ---------------------------------------------------------------

  async listTasks(userId: string, filters: ListTasksFilters = {}) {
    const where: Record<string, any> = {
      // Default scope: tasks the user owns or is assigned to.
      OR: [{ createdById: userId }, { assigneeId: userId }],
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.assigneeId) {
      this.validateUuid(filters.assigneeId);
      where.assigneeId = filters.assigneeId;
    }
    if (filters.projectId) {
      this.validateUuid(filters.projectId);
      where.projectId = filters.projectId;
    }

    return this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [
        { status: 'asc' },
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getTask(id: string, userId: string) {
    this.validateUuid(id);
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    // Allow if user is creator or assignee.
    if (task.createdById !== userId && task.assigneeId !== userId) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        projectId: dto.projectId ?? undefined,
        assigneeId: dto.assigneeId ?? undefined,
        createdById: userId,
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(task);
    return task;
  }

  async updateTask(id: string, userId: string, dto: UpdateTaskDto) {
    this.validateUuid(id);

    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    if (existing.createdById !== userId && existing.assigneeId !== userId) {
      throw new ForbiddenException('Only the creator or assignee may update this task');
    }

    // Handle completedAt transitions.
    let completedAt: Date | null | undefined;
    if (dto.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
      completedAt = new Date();
    } else if (dto.status && dto.status !== TaskStatus.DONE && existing.status === TaskStatus.DONE) {
      completedAt = null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        // dueAt: null means clear; string means set; undefined means no change.
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt === null ? null : new Date(dto.dueAt) }
          : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(task);
    // Also publish to the old assignee if it changed.
    if (dto.assigneeId !== undefined && existing.assigneeId && existing.assigneeId !== userId) {
      this.publish(existing.assigneeId, { type: 'tasks-changed' });
    }
    return task;
  }

  async deleteTask(id: string, userId: string) {
    this.validateUuid(id);

    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    if (existing.createdById !== userId) {
      throw new ForbiddenException('Only the creator may delete this task');
    }

    await this.prisma.task.delete({ where: { id } });
    this.publishToRelevantUsers(existing);
  }

  async convertMessageToTask(userId: string, dto: ConvertMessageToTaskDto) {
    let body: string | null = null;
    let projectId: string | undefined;

    if (dto.sourceType === 'project_message') {
      this.validateUuid(dto.sourceId);
      const msg = await this.prisma.projectMessage.findUnique({
        where: { id: dto.sourceId },
        select: { body: true, projectId: true },
      });
      if (!msg) throw new NotFoundException('Source message not found');
      body = msg.body;
      projectId = msg.projectId;
    } else if (dto.sourceType === 'direct_message') {
      this.validateUuid(dto.sourceId);
      const msg = await this.prisma.directMessage.findUnique({
        where: { id: dto.sourceId },
        select: { body: true },
      });
      if (!msg) throw new NotFoundException('Source message not found');
      body = msg.body;
    } else if (dto.sourceType === 'channel_message') {
      this.validateUuid(dto.sourceId);
      const msg = await this.prisma.channelMessage.findUnique({
        where: { id: dto.sourceId },
        select: { body: true },
      });
      if (!msg) throw new NotFoundException('Source message not found');
      body = msg.body;
    }

    const title = dto.title ?? (body ? body.slice(0, 120) : 'New Task');

    const task = await this.prisma.task.create({
      data: {
        title,
        createdById: userId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        ...(projectId ? { projectId } : {}),
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(task);
    return task;
  }

  async getUnreadCounts(userId: string): Promise<{ assignedOpen: number; overdue: number }> {
    const now = new Date();

    const [assignedOpen, overdue] = await Promise.all([
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: { not: TaskStatus.DONE },
        },
      }),
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: { not: TaskStatus.DONE },
          dueAt: { lt: now },
        },
      }),
    ]);

    return { assignedOpen, overdue };
  }
}
