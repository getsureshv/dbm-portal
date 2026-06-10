import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from './permissions.service';
import { AuditService } from './audit.service';

export interface MatrixRow {
  entity: string;
  actions: string[];
  scope: 'ALL' | 'OWN' | 'ASSIGNED';
}

/**
 * AdminPersonasService (PR7, FR-6/FR-7/FR-9) — persona CRUD, clone, archive,
 * and full-replace of a persona's permission matrix, plus the entity registry
 * and a user effective-permissions debug view.
 *
 * Guard rails (FR-6):
 *   - isSystem personas (admin, client) cannot be archived/deleted.
 *   - the admin persona can never lose `persona:update` on the `persona` entity
 *     (no lock-out) — enforced on matrix replace.
 *   - archiving a persona with active holders is rejected unless `force` (FR-9).
 *
 * Every mutation writes exactly one audit event in the same transaction (FR-19).
 */
@Injectable()
export class AdminPersonasService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private audit: AuditService,
  ) {}

  // ─── Read ──────────────────────────────────────────────

  /** Persona list with holder counts (Admin UI persona list, §6.1). */
  async list() {
    const personas = await this.prisma.persona.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { userPersonas: true } },
        permissions: { select: { entityKey: true, actions: true, scope: true } },
      },
    });
    return personas.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      baseType: p.baseType,
      isSystem: p.isSystem,
      status: p.status,
      requiresApproval: p.requiresApproval,
      holderCount: p._count.userPersonas,
      permissions: p.permissions.map((pp) => ({
        entity: pp.entityKey,
        actions: pp.actions,
        scope: pp.scope,
      })),
    }));
  }

  async get(id: string) {
    const p = await this.prisma.persona.findUnique({
      where: { id },
      include: { permissions: true, _count: { select: { userPersonas: true } } },
    });
    if (!p) throw new NotFoundException('Persona not found');
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      baseType: p.baseType,
      isSystem: p.isSystem,
      status: p.status,
      requiresApproval: p.requiresApproval,
      holderCount: p._count.userPersonas,
      permissions: p.permissions.map((pp) => ({
        entity: pp.entityKey,
        actions: pp.actions,
        scope: pp.scope,
      })),
    };
  }

  // ─── Create / clone ────────────────────────────────────

  async create(
    input: {
      name: string;
      slug: string;
      description?: string;
      baseType: string;
      requiresApproval?: boolean;
    },
    actorId: string,
  ) {
    const exists = await this.prisma.persona.findUnique({ where: { slug: input.slug } });
    if (exists) throw new ConflictException('A persona with that slug already exists');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.persona.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          baseType: input.baseType as any,
          requiresApproval: input.requiresApproval ?? false,
          isSystem: false,
          createdBy: actorId,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'persona.created',
          subjectType: 'persona',
          subjectId: created.id,
          before: null,
          after: created,
        },
        tx,
      );
      return created;
    });
  }

  /** Clone a persona (new slug) including its permission matrix (FR-6). */
  async clone(id: string, input: { name: string; slug: string }, actorId: string) {
    const source = await this.prisma.persona.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!source) throw new NotFoundException('Persona not found');
    const slugTaken = await this.prisma.persona.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new ConflictException('A persona with that slug already exists');

    return this.prisma.$transaction(async (tx) => {
      const clone = await tx.persona.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: source.description,
          baseType: 'CUSTOM',
          requiresApproval: source.requiresApproval,
          isSystem: false,
          createdBy: actorId,
          permissions: {
            create: source.permissions.map((pp) => ({
              entityKey: pp.entityKey,
              actions: pp.actions,
              scope: pp.scope,
            })),
          },
        },
        include: { permissions: true },
      });
      await this.audit.record(
        {
          actorId,
          action: 'persona.cloned',
          subjectType: 'persona',
          subjectId: clone.id,
          before: { clonedFrom: source.id },
          after: clone,
        },
        tx,
      );
      return clone;
    });
  }

  // ─── Update / archive ──────────────────────────────────

  async update(
    id: string,
    input: Partial<{ name: string; description: string; requiresApproval: boolean }>,
    actorId: string,
  ) {
    const before = await this.prisma.persona.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Persona not found');

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.persona.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.requiresApproval !== undefined
            ? { requiresApproval: input.requiresApproval }
            : {}),
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'persona.updated',
          subjectType: 'persona',
          subjectId: id,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  /** Archive a persona (FR-6/FR-9). System personas cannot be archived. */
  async archive(id: string, opts: { force?: boolean }, actorId: string) {
    const persona = await this.prisma.persona.findUnique({
      where: { id },
      include: { _count: { select: { userPersonas: true } } },
    });
    if (!persona) throw new NotFoundException('Persona not found');
    if (persona.isSystem) {
      throw new BadRequestException('System personas cannot be archived');
    }
    const activeHolders = await this.prisma.userPersona.count({
      where: { personaId: id, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (activeHolders > 0 && !opts.force) {
      throw new ConflictException(
        `Persona has ${activeHolders} active holder(s); reassign or pass force=true to archive (FR-9)`,
      );
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const a = await tx.persona.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      await this.audit.record(
        {
          actorId,
          action: 'persona.archived',
          subjectType: 'persona',
          subjectId: id,
          before: persona,
          after: a,
        },
        tx,
      );
      return a;
    });
    // Holders' effective access changes (archived persona stops granting).
    this.permissions.bustAll();
    return after;
  }

  // ─── Permission matrix ─────────────────────────────────

  /**
   * Full-replace a persona's permission matrix (FR-7). Validates every row's
   * entity + actions against the entity registry, and enforces the admin
   * no-lock-out rule (the admin persona must keep persona:update). Busts all
   * caches so changes apply within the TTL.
   */
  async replacePermissions(id: string, rows: MatrixRow[], actorId: string) {
    const persona = await this.prisma.persona.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!persona) throw new NotFoundException('Persona not found');

    // Validate against the entity registry.
    const entities = await this.prisma.entity.findMany();
    const registry = new Map(entities.map((e) => [e.key, new Set(e.actions)]));
    for (const row of rows) {
      const allowed = registry.get(row.entity);
      if (!allowed) {
        throw new BadRequestException(`Unknown entity "${row.entity}"`);
      }
      for (const a of row.actions) {
        if (!allowed.has(a)) {
          throw new BadRequestException(
            `Action "${a}" is not valid for entity "${row.entity}"`,
          );
        }
      }
    }

    // FR-6 no-lock-out: the admin persona must retain persona:update.
    if (persona.slug === 'admin') {
      const personaRow = rows.find((r) => r.entity === 'persona');
      if (!personaRow || !personaRow.actions.includes('update')) {
        throw new BadRequestException(
          'The Admin persona cannot lose persona:update (no lock-out)',
        );
      }
    }

    const before = persona.permissions.map((pp) => ({
      entity: pp.entityKey,
      actions: pp.actions,
      scope: pp.scope,
    }));

    const after = await this.prisma.$transaction(async (tx) => {
      await tx.personaPermission.deleteMany({ where: { personaId: id } });
      for (const row of rows) {
        await tx.personaPermission.create({
          data: {
            personaId: id,
            entityKey: row.entity,
            actions: row.actions,
            scope: row.scope,
          },
        });
      }
      await this.audit.record(
        {
          actorId,
          action: 'persona.permissions_replaced',
          subjectType: 'persona',
          subjectId: id,
          before,
          after: rows,
        },
        tx,
      );
      return rows;
    });

    this.permissions.bustAll();
    return { personaId: id, permissions: after };
  }

  // ─── Entity registry ───────────────────────────────────

  async listEntities() {
    return this.prisma.entity.findMany({ orderBy: { key: 'asc' } });
  }

  async updateEntity(
    key: string,
    input: Partial<{ label: string; actions: string[]; supportsRecordGrants: boolean }>,
    actorId: string,
  ) {
    const before = await this.prisma.entity.findUnique({ where: { key } });
    if (!before) throw new NotFoundException('Entity not found');

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.entity.update({
        where: { key },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.actions !== undefined ? { actions: input.actions } : {}),
          ...(input.supportsRecordGrants !== undefined
            ? { supportsRecordGrants: input.supportsRecordGrants }
            : {}),
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'entity.updated',
          subjectType: 'entity',
          subjectId: key,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  // ─── User effective-permissions debug ──────────────────

  async userEffectivePermissions(userId: string) {
    return this.permissions.effectivePermissions(userId);
  }

  // ─── Users + approvals (Admin UI user-access & approvals) ──

  /** A user's persona assignments with persona detail (US-09 user-access page). */
  async userPersonas(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, providerType: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const rows = await this.prisma.userPersona.findMany({
      where: { userId },
      include: { persona: { select: { id: true, slug: true, name: true, baseType: true } } },
      orderBy: { assignedAt: 'asc' },
    });
    return {
      user,
      personas: rows.map((r) => ({
        personaId: r.persona.id,
        slug: r.persona.slug,
        name: r.persona.name,
        baseType: r.persona.baseType,
        status: r.status,
        assignedAt: r.assignedAt,
        expiresAt: r.expiresAt,
      })),
    };
  }

  /** Pending provider signups awaiting vetting (Admin UI approvals queue, §6.5). */
  async pendingApprovals() {
    const rows = await this.prisma.userPersona.findMany({
      where: { status: 'PENDING' },
      include: {
        persona: { select: { id: true, slug: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });
    return rows.map((r) => ({
      userId: r.userId,
      user: r.user,
      personaId: r.persona.id,
      personaSlug: r.persona.slug,
      personaName: r.persona.name,
      assignedAt: r.assignedAt,
    }));
  }
}
