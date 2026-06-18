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
  assignments: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type AssignmentLike = { startedAt?: Date | null; completedAt: Date | null };

// Derive task status from its assignments. With no assignments we keep the
// task's current (manual) status untouched. With assignments: DONE when every
// part is completed; IN_PROGRESS as soon as ANY part is started or completed;
// otherwise TODO.
function deriveStatus(
  assignments: AssignmentLike[],
  fallback: TaskStatus,
): TaskStatus {
  if (assignments.length === 0) return fallback;
  const doneCount = assignments.filter((a) => a.completedAt !== null).length;
  if (doneCount === assignments.length) return TaskStatus.DONE;
  const anyActive = assignments.some(
    (a) => a.startedAt != null || a.completedAt != null,
  );
  return anyActive ? TaskStatus.IN_PROGRESS : TaskStatus.TODO;
}

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

  private publishToRelevantUsers(task: {
    createdById: string;
    assigneeId?: string | null;
    assignments?: { userId: string }[];
  }) {
    const event: TasksChangedEvent = { type: 'tasks-changed' };
    const recipients = new Set<string>();
    recipients.add(task.createdById);
    if (task.assigneeId) recipients.add(task.assigneeId);
    for (const a of task.assignments ?? []) recipients.add(a.userId);
    for (const userId of recipients) this.publish(userId, event);
  }

  // ---- queries ---------------------------------------------------------------

  async listTasks(userId: string, filters: ListTasksFilters = {}) {
    const where: Record<string, any> = {
      // Default scope: tasks the user owns, is the legacy assignee of, or has
      // a TaskAssignment for.
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        { assignments: { some: { userId } } },
      ],
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
    // Allow if user is creator, legacy assignee, or an assignment member.
    const isMember =
      task.createdById === userId ||
      task.assigneeId === userId ||
      task.assignments.some((a) => a.userId === userId);
    if (!isMember) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    // Resolve the assignee set: prefer assigneeIds, else fall back to the
    // single legacy assigneeId. Dedupe.
    const ids = dto.assigneeIds && dto.assigneeIds.length > 0
      ? dto.assigneeIds
      : dto.assigneeId
        ? [dto.assigneeId]
        : [];
    const uniqueIds = Array.from(new Set(ids));

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        projectId: dto.projectId ?? undefined,
        // Keep legacy single column populated with the first assignee.
        assigneeId: uniqueIds[0] ?? undefined,
        createdById: userId,
        assignments: {
          create: uniqueIds.map((uid) => ({ userId: uid })),
        },
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(task);
    return task;
  }

  async updateTask(id: string, userId: string, dto: UpdateTaskDto) {
    this.validateUuid(id);

    const existing = await this.prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    // Editing task fields is creator-only. Assignees (receivers) mark their own
    // part done via the complete/uncomplete endpoints, not by PATCHing here.
    if (existing.createdById !== userId) {
      throw new ForbiddenException('Only the task creator may edit this task');
    }

    // Reconcile the assignment set when assigneeIds is supplied.
    const replacingAssignees = dto.assigneeIds !== undefined;
    let nextAssigneeIds: string[] = existing.assignments.map((a) => a.userId);
    if (replacingAssignees) {
      const desired = Array.from(new Set(dto.assigneeIds ?? []));
      const current = new Set(existing.assignments.map((a) => a.userId));
      const desiredSet = new Set(desired);
      const toAdd = desired.filter((uid) => !current.has(uid));
      const toRemove = existing.assignments
        .filter((a) => !desiredSet.has(a.userId))
        .map((a) => a.userId);

      if (toRemove.length > 0) {
        await this.prisma.taskAssignment.deleteMany({
          where: { taskId: id, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await this.prisma.taskAssignment.createMany({
          data: toAdd.map((uid) => ({ taskId: id, userId: uid })),
          skipDuplicates: true,
        });
      }
      nextAssigneeIds = desired;
    }

    // Recompute derived status from the (post-reconcile) assignment rows.
    const liveAssignments = await this.prisma.taskAssignment.findMany({
      where: { taskId: id },
      select: { startedAt: true, completedAt: true },
    });

    // Determine the status + completedAt to persist.
    let nextStatus: TaskStatus;
    let completedAt: Date | null | undefined;

    if (liveAssignments.length > 0) {
      // Multi-assignee tasks: status is fully derived from per-person completion.
      nextStatus = deriveStatus(liveAssignments, existing.status);
      if (nextStatus === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
        completedAt = new Date();
      } else if (nextStatus !== TaskStatus.DONE && existing.status === TaskStatus.DONE) {
        completedAt = null;
      }
    } else {
      // No assignments: preserve the legacy manual status override flow.
      nextStatus = dto.status ?? existing.status;
      if (dto.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
        completedAt = new Date();
      } else if (
        dto.status &&
        dto.status !== TaskStatus.DONE &&
        existing.status === TaskStatus.DONE
      ) {
        completedAt = null;
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        status: nextStatus,
        // dueAt: null means clear; string means set; undefined means no change.
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt === null ? null : new Date(dto.dueAt) }
          : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        // Keep legacy single column in sync: explicit assigneeId wins, else
        // mirror the first of the reconciled assignment set.
        ...(dto.assigneeId !== undefined
          ? { assigneeId: dto.assigneeId }
          : replacingAssignees
            ? { assigneeId: nextAssigneeIds[0] ?? null }
            : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(task);
    // Also notify anyone who was dropped from the assignment set / old assignee.
    const dropped = existing.assignments
      .map((a) => a.userId)
      .filter((uid) => !task.assignments.some((a) => a.userId === uid));
    for (const uid of dropped) this.publish(uid, { type: 'tasks-changed' });
    if (
      dto.assigneeId !== undefined &&
      existing.assigneeId &&
      existing.assigneeId !== userId
    ) {
      this.publish(existing.assigneeId, { type: 'tasks-changed' });
    }
    return task;
  }

  // Mark (or unmark) the requesting user's own part of a task complete.
  async setAssignmentCompletion(taskId: string, userId: string, done: boolean) {
    this.validateUuid(taskId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignments: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const assignment = task.assignments.find((a) => a.userId === userId);
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    const now = new Date();
    await this.prisma.taskAssignment.update({
      where: { id: assignment.id },
      data: {
        completedAt: done ? now : null,
        // Completing implies started. Un-completing leaves startedAt as-is
        // (they're still working on it).
        ...(done && assignment.startedAt == null ? { startedAt: now } : {}),
      },
    });

    const liveAssignments = await this.prisma.taskAssignment.findMany({
      where: { taskId },
      select: { startedAt: true, completedAt: true },
    });
    const nextStatus = deriveStatus(liveAssignments, task.status);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === TaskStatus.DONE ? new Date() : null,
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(updated);
    return updated;
  }

  // Mark (or unmark) the requesting user's own part as started ("working on
  // it") without completing it. Assignee-only.
  async setAssignmentStarted(taskId: string, userId: string, started: boolean) {
    this.validateUuid(taskId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignments: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const assignment = task.assignments.find((a) => a.userId === userId);
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    await this.prisma.taskAssignment.update({
      where: { id: assignment.id },
      data: { startedAt: started ? new Date() : null },
    });

    const liveAssignments = await this.prisma.taskAssignment.findMany({
      where: { taskId },
      select: { startedAt: true, completedAt: true },
    });
    const nextStatus = deriveStatus(liveAssignments, task.status);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === TaskStatus.DONE ? new Date() : null,
      },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(updated);
    return updated;
  }

  // Creator-only: force the entire task complete regardless of per-person state.
  async forceComplete(taskId: string, userId: string) {
    this.validateUuid(taskId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignments: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.createdById !== userId) {
      throw new ForbiddenException('Only the task creator may force-complete this task');
    }

    const now = new Date();
    await this.prisma.taskAssignment.updateMany({
      where: { taskId, completedAt: null },
      data: { completedAt: now },
    });
    // Completing implies started — fill any missing start timestamps.
    await this.prisma.taskAssignment.updateMany({
      where: { taskId, startedAt: null },
      data: { startedAt: now },
    });

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.DONE, completedAt: now },
      include: TASK_INCLUDE,
    });

    this.publishToRelevantUsers(updated);
    return updated;
  }

  async deleteTask(id: string, userId: string) {
    this.validateUuid(id);

    const existing = await this.prisma.task.findUnique({
      where: { id },
      include: { assignments: { select: { userId: true } } },
    });
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

    // Count per-person: a task leaves the user's bell the moment THEY complete
    // their own assignment, even if teammates are still pending.
    const [assignedOpen, overdue] = await Promise.all([
      this.prisma.taskAssignment.count({
        where: { userId, completedAt: null },
      }),
      this.prisma.taskAssignment.count({
        where: {
          userId,
          completedAt: null,
          task: { dueAt: { lt: now } },
        },
      }),
    ]);

    return { assignedOpen, overdue };
  }
}
