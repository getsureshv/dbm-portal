import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  decide,
  can,
  buildScopeFilter,
  ScopeFilterDescriptor,
} from './engine/permission-engine';
import {
  PrincipalContext,
  ActivePersona,
  ApplicableGrant,
  RecordContext,
  Decision,
} from './engine/types';

/**
 * PermissionsService (PR3) — the NestJS/Prisma loader that feeds the pure
 * `can()` engine (PR2). Responsibilities:
 *
 *  - Build a {@link PrincipalContext} for a user: active personas (+matrices)
 *    and the record grants that currently apply to them (FR-15.1/15.3).
 *  - Cache the principal context for ≤5 min, busted on assignment change
 *    (FR-15.1). Cache is keyed by userId.
 *  - Resolve a {@link RecordContext} (owner / participants) for a concrete
 *    record so OWN/ASSIGNED scopes can be evaluated.
 *  - Lazily expire user_personas and record_grants past expiresAt at read time
 *    (FR-18, the daily job in PR5 is the belt-and-suspenders companion).
 *
 * The actual allow/deny logic lives entirely in the pure engine; this class
 * only does I/O and caching.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // FR-15.1: ≤5 minutes.

interface CacheEntry {
  ctx: PrincipalContext;
  expiresAt: number;
}

@Injectable()
export class PermissionsService {
  private cache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  /** Invalidate a user's cached context (call on persona assign/revoke/edit). */
  bust(userId: string): void {
    this.cache.delete(userId);
  }

  /** Invalidate everyone (call when a persona's matrix changes). */
  bustAll(): void {
    this.cache.clear();
  }

  /**
   * Build (or return cached) the principal context for a user. Loads only
   * ACTIVE, unexpired personas and ACTIVE, unexpired grants (lazy expiry,
   * FR-18). Permission matrices are flattened to the engine's shape.
   */
  async getContext(userId: string): Promise<PrincipalContext> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.ctx;

    const now = new Date();

    // Active personas (status ACTIVE, not past expiry) + their matrices.
    const userPersonas = await this.prisma.userPersona.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        persona: {
          include: { permissions: true },
        },
      },
    });

    const personas: ActivePersona[] = userPersonas
      // Defensive: only personas that are themselves ACTIVE (not archived).
      .filter((up) => up.persona.status === 'ACTIVE')
      .map((up) => ({
        personaId: up.persona.id,
        slug: up.persona.slug,
        permissions: up.persona.permissions.map((p) => ({
          entity: p.entityKey,
          actions: p.actions,
          scope: p.scope as ActivePersona['permissions'][number]['scope'],
        })),
      }));

    // Transitional safety net (legacy columns coexist during the build):
    // if a user has a legacy role but no UserPersona row yet (e.g. they set
    // their role between deploys, before the seed back-fill ran, or before
    // PR4's auto-assignment is live), synthesize their persona context from
    // the legacy role so the live app never regresses. Removed in the final
    // legacy-column cleanup PR.
    if (personas.length === 0) {
      const legacy = await this.legacyContextFallback(userId);
      if (legacy) personas.push(legacy);
    }

    const personaIds = personas.map((p) => p.personaId);

    // Applicable record grants: direct to the user OR to a persona they hold.
    // Active + unexpired only (lazy expiry).
    const grantRows = await this.prisma.recordGrant.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [
          {
            OR: [
              { granteeType: 'USER', granteeId: userId },
              ...(personaIds.length
                ? [{ granteeType: 'PERSONA' as const, granteeId: { in: personaIds } }]
                : []),
            ],
          },
        ],
      },
    });

    const grants: ApplicableGrant[] = grantRows.map((g) => ({
      entity: g.entity,
      recordId: g.recordId,
      actions: g.actions,
    }));

    const ctx: PrincipalContext = { userId, personas, grants };
    this.cache.set(userId, { ctx, expiresAt: Date.now() + CACHE_TTL_MS });
    return ctx;
  }

  /** Map a legacy (role, providerType) pair to the seed persona slug. */
  private legacyPersonaSlug(
    role: string | null,
    providerType: string | null,
  ): string | null {
    if (role === 'ADMIN') return 'admin';
    if (role === 'OWNER') return 'client';
    if (role === 'PROVIDER') {
      switch (providerType) {
        case 'PROFESSIONAL':
          return 'planning-design-professional';
        case 'SUPPLIER':
          return 'supplier';
        case 'FREIGHT':
          return 'freight';
        default:
          return null;
      }
    }
    return null;
  }

  /**
   * Build an ActivePersona straight from the user's legacy role columns by
   * loading the matching seed persona's matrix. Returns null if the user has
   * no recognized legacy role or the persona is missing/archived.
   */
  private async legacyContextFallback(
    userId: string,
  ): Promise<ActivePersona | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, providerType: true },
    });
    if (!user) return null;
    const slug = this.legacyPersonaSlug(
      user.role as string | null,
      user.providerType as string | null,
    );
    if (!slug) return null;

    const persona = await this.prisma.persona.findUnique({
      where: { slug },
      include: { permissions: true },
    });
    if (!persona || persona.status !== 'ACTIVE') return null;

    return {
      personaId: persona.id,
      slug: persona.slug,
      permissions: persona.permissions.map((p) => ({
        entity: p.entityKey,
        actions: p.actions,
        scope: p.scope as ActivePersona['permissions'][number]['scope'],
      })),
    };
  }

  /**
   * Resolve owner / participant facts for a concrete record so OWN/ASSIGNED can
   * be evaluated. Entity-registry-driven; concrete resolvers exist for the
   * entities that have real records today (project, document). Unknown entities
   * resolve to "no owner / no participants" → only ALL scope or a record grant
   * can satisfy them (safe default).
   */
  async resolveRecord(entity: string, recordId: string): Promise<RecordContext | null> {
    switch (entity) {
      case 'project': {
        const p = await this.prisma.project.findUnique({
          where: { id: recordId },
          select: { id: true, ownerId: true },
        });
        if (!p) return null;
        // No participant table exists yet; participantIds is empty until the
        // project_invitations model lands. Owners still resolve via OWN.
        return { id: p.id, ownerId: p.ownerId, participantIds: [] };
      }
      case 'document': {
        // A document's authoritative owner is the OWNER OF ITS PROJECT (this
        // mirrors DocumentsService, which checks doc.project.ownerId — not the
        // uploader). Resolving owner any other way would let the guard 404 a
        // legitimate project owner before the service runs, regressing the live
        // app. participantIds stays empty until a participation model exists.
        const d = await this.prisma.projectDocument.findUnique({
          where: { id: recordId },
          select: {
            id: true,
            uploadedById: true,
            project: { select: { ownerId: true } },
          },
        });
        if (!d) return null;
        return {
          id: d.id,
          ownerId: d.project?.ownerId ?? d.uploadedById,
          participantIds: [],
        };
      }
      default:
        // Entity has no owner/participant wiring; only ALL scope or a grant
        // applies. Return a recordless context so OWN/ASSIGNED fail closed.
        return { id: recordId, ownerId: null, participantIds: [] };
    }
  }

  /**
   * Full check used by the guard. Loads context, resolves the record (if a
   * recordId is given and it is not a create), and asks the engine.
   *
   * Returns the {@link Decision} plus a `recordMissing` flag so the guard can
   * 404 cleanly when the record does not exist (avoids leaking existence the
   * same way a deny does).
   */
  async check(
    userId: string,
    action: string,
    entity: string,
    recordId?: string,
  ): Promise<{ decision: Decision; recordMissing: boolean }> {
    const ctx = await this.getContext(userId);

    if (action === 'create' || !recordId) {
      return { decision: decide(ctx, action, entity), recordMissing: false };
    }

    const record = await this.resolveRecord(entity, recordId);
    if (record === null) {
      // Record doesn't exist. Treat as deny → guard returns 404.
      return {
        decision: { allowed: false, reason: 'no-matching-permission' },
        recordMissing: true,
      };
    }
    return { decision: decide(ctx, action, entity, record), recordMissing: false };
  }

  /** Convenience boolean wrapper. */
  async can(
    userId: string,
    action: string,
    entity: string,
    record?: RecordContext,
  ): Promise<boolean> {
    const ctx = await this.getContext(userId);
    return can(ctx, action, entity, record);
  }

  /**
   * FR-16 — build a scope-filter descriptor for list endpoints. Services use
   * {@link scopePrismaWhere} to turn this into a Prisma `where` clause.
   */
  async scopeFilter(
    userId: string,
    action: string,
    entity: string,
  ): Promise<ScopeFilterDescriptor> {
    const ctx = await this.getContext(userId);
    return buildScopeFilter(ctx, action, entity);
  }

  /** My effective permissions, for the /me/permissions debug view (FR spec §5). */
  async effectivePermissions(userId: string) {
    const ctx = await this.getContext(userId);
    return {
      userId,
      personas: ctx.personas.map((p) => ({ slug: p.slug, permissions: p.permissions })),
      grants: ctx.grants,
    };
  }
}
