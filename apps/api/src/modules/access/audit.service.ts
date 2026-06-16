import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/**
 * A Prisma client OR an interactive-transaction client. Audit writes accept
 * either so a mutation and its audit event commit atomically (FR-19).
 */
export type PrismaLike = PrismaService | Prisma.TransactionClient;

export interface AuditEvent {
  /** Who performed the change. Null for system/anonymous actions. */
  actorId?: string | null;
  /** Dotted action, e.g. "record_grant.created", "persona.assigned". */
  action: string;
  /** Subject entity type, e.g. "record_grant", "user_persona", "persona". */
  subjectType: string;
  /** Subject id (the row affected), when applicable. */
  subjectId?: string | null;
  /** State before the change (null for creates). */
  before?: unknown;
  /** State after the change (null for deletes). */
  after?: unknown;
}

/**
 * AuditService (PR6, FR-19/FR-20) — append-only authorization audit log.
 *
 * `record()` writes exactly one immutable row. Pass the active transaction
 * client (`tx`) so the audit event commits in the SAME transaction as the
 * mutation it describes — if the mutation rolls back, so does its audit row,
 * and vice-versa. There are no update/delete methods: the log is append-only.
 *
 * `query()` backs GET /admin/audit with filters by actor, subject type/id and
 * a date range (FR-20). Read-only.
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Append one audit event. Pass `tx` to commit atomically with a mutation;
   * omit it for a standalone event (uses the base client).
   */
  async record(event: AuditEvent, tx?: PrismaLike) {
    const client = tx ?? this.prisma;
    return client.permissionAuditLog.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId ?? null,
        before: toJson(event.before),
        after: toJson(event.after),
      },
    });
  }

  /** Filterable, read-only audit query (FR-20). */
  async query(filters: {
    actorId?: string;
    subjectType?: string;
    subjectId?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }) {
    const where: Prisma.PermissionAuditLogWhereInput = {};
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.subjectType) where.subjectType = filters.subjectType;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.from || filters.to) {
      where.at = {};
      if (filters.from) (where.at as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.at as Prisma.DateTimeFilter).lte = new Date(filters.to);
    }

    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const rows = await this.prisma.permissionAuditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take: take + 1, // fetch one extra to compute nextCursor
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}

/** Normalize an arbitrary value into a Prisma-Json-safe value (or DbNull). */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
