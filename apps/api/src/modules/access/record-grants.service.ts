import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from './permissions.service';

export interface AccessPrincipal {
  /** USER or PERSONA */
  principalType: 'USER' | 'PERSONA';
  principalId: string;
  label: string;
  /** Why this principal has access. */
  source: 'OWNER' | 'PARTICIPANT' | 'PERSONA_SCOPE' | 'GRANT';
  /** Actions implied by the source (best-effort; grants are explicit). */
  actions?: string[];
  /** Extra context: scope for persona, reason/expiry for grants. */
  detail?: Record<string, unknown>;
}

/**
 * RecordGrantsService (PR5, FR-11…FR-13).
 *
 *  - create(): issue a record grant to a USER or PERSONA with a mandatory
 *    reason + optional expiry. Validates the persona/user exists. Busts the
 *    affected principals' permission cache so it takes effect immediately
 *    (FR-12: no long-lived caches of grant results).
 *  - revoke(): flips a grant to REVOKED and busts caches.
 *  - expireOverdue(): the daily-job half of FR-18 (lazy read-time expiry already
 *    lives in PermissionsService). Idempotent; safe to call from an external
 *    Render Cron Job or an admin endpoint. Flips past-expiry ACTIVE grants and
 *    user_personas to EXPIRED.
 *  - whoCanAccess(): the record-access report (FR-13). Lists every principal
 *    with access to a record and the source of that access.
 *
 * Audit events (FR-19) are wired in PR6 — this service exposes the mutations
 * those events will wrap.
 */
@Injectable()
export class RecordGrantsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  /** Issue a record grant (FR-11). */
  async create(input: {
    entity: string;
    recordId: string;
    granteeType: 'USER' | 'PERSONA';
    granteeId: string;
    actions: string[];
    reason: string;
    expiresAt?: string | null;
    grantedBy: string;
  }) {
    // Validate the grantee exists so we never issue a dangling grant.
    if (input.granteeType === 'USER') {
      const u = await this.prisma.user.findUnique({
        where: { id: input.granteeId },
        select: { id: true },
      });
      if (!u) throw new NotFoundException('Grantee user not found');
    } else {
      const p = await this.prisma.persona.findUnique({
        where: { id: input.granteeId },
        select: { id: true },
      });
      if (!p) throw new NotFoundException('Grantee persona not found');
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    const grant = await this.prisma.recordGrant.create({
      data: {
        entity: input.entity,
        recordId: input.recordId,
        granteeType: input.granteeType,
        granteeId: input.granteeId,
        actions: input.actions,
        reason: input.reason,
        grantedBy: input.grantedBy,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    await this.bustGrantee(input.granteeType, input.granteeId);
    return grant;
  }

  /** Revoke a record grant (FR-12). Idempotent on an already-inactive grant. */
  async revoke(grantId: string) {
    const grant = await this.prisma.recordGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Record grant not found');

    if (grant.status === 'ACTIVE') {
      await this.prisma.recordGrant.update({
        where: { id: grantId },
        data: { status: 'REVOKED' },
      });
      await this.bustGrantee(grant.granteeType, grant.granteeId);
    }
    return { id: grantId, status: 'REVOKED' as const };
  }

  /**
   * Daily-job expiry (FR-18). Flips ACTIVE rows whose expiresAt has passed to
   * EXPIRED for both record_grants and user_personas. Returns counts. The
   * permission cache uses a ≤5min TTL + lazy filter, so callers see expiry
   * immediately regardless; this just keeps stored status truthful for reports.
   */
  async expireOverdue(now: Date = new Date()) {
    const grants = await this.prisma.recordGrant.updateMany({
      where: { status: 'ACTIVE', expiresAt: { not: null, lt: now } },
      data: { status: 'EXPIRED' },
    });
    const personas = await this.prisma.userPersona.updateMany({
      where: { status: 'ACTIVE', expiresAt: { not: null, lt: now } },
      data: { status: 'EXPIRED' },
    });
    // Cache is short-lived; full bust keeps things consistent after a sweep.
    this.permissions.bustAll();
    return {
      expiredGrants: grants.count,
      expiredPersonas: personas.count,
    };
  }

  /**
   * Record-access report (FR-13). Enumerates every principal who can access a
   * record and why: ownership, participation, persona scope, or explicit grant.
   *
   * Note: persona-scope rows describe *which personas* have a matching ALL-scope
   * permission on the entity (so every active holder has access). OWN/ASSIGNED
   * scopes are covered by the OWNER/PARTICIPANT rows for this specific record.
   */
  async whoCanAccess(entity: string, recordId: string): Promise<AccessPrincipal[]> {
    const principals: AccessPrincipal[] = [];

    // 1. Ownership / participation for this specific record.
    const record = await this.permissions.resolveRecord(entity, recordId);
    if (record?.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: record.ownerId },
        select: { id: true, email: true, name: true },
      });
      principals.push({
        principalType: 'USER',
        principalId: record.ownerId,
        label: owner?.name || owner?.email || record.ownerId,
        source: 'OWNER',
      });
    }
    for (const pid of record?.participantIds ?? []) {
      principals.push({
        principalType: 'USER',
        principalId: pid,
        label: pid,
        source: 'PARTICIPANT',
      });
    }

    // 2. Personas with an ALL-scope permission on this entity (any action) →
    //    every active holder can reach every record of this type.
    const scopedPersonas = await this.prisma.persona.findMany({
      where: {
        status: 'ACTIVE',
        permissions: { some: { entityKey: entity, scope: 'ALL' } },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        permissions: {
          where: { entityKey: entity, scope: 'ALL' },
          select: { actions: true },
        },
      },
    });
    for (const p of scopedPersonas) {
      principals.push({
        principalType: 'PERSONA',
        principalId: p.id,
        label: p.name,
        source: 'PERSONA_SCOPE',
        actions: p.permissions.flatMap((pp) => pp.actions),
        detail: { slug: p.slug, scope: 'ALL' },
      });
    }

    // 3. Explicit, active, unexpired grants on this record.
    const now = new Date();
    const grants = await this.prisma.recordGrant.findMany({
      where: {
        entity,
        recordId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    for (const g of grants) {
      let label = g.granteeId;
      if (g.granteeType === 'USER') {
        const u = await this.prisma.user.findUnique({
          where: { id: g.granteeId },
          select: { email: true, name: true },
        });
        label = u?.name || u?.email || g.granteeId;
      } else {
        const p = await this.prisma.persona.findUnique({
          where: { id: g.granteeId },
          select: { name: true },
        });
        label = p?.name || g.granteeId;
      }
      principals.push({
        principalType: g.granteeType,
        principalId: g.granteeId,
        label,
        source: 'GRANT',
        actions: g.actions,
        detail: { grantId: g.id, reason: g.reason, expiresAt: g.expiresAt },
      });
    }

    return principals;
  }

  /** List grants for a record (admin view backing the report). */
  async listForRecord(entity: string, recordId: string) {
    return this.prisma.recordGrant.findMany({
      where: { entity, recordId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /** Bust the permission cache for every principal a grant affects. */
  private async bustGrantee(granteeType: 'USER' | 'PERSONA', granteeId: string) {
    if (granteeType === 'USER') {
      this.permissions.bust(granteeId);
      return;
    }
    // PERSONA grant: every active holder's effective access changes.
    const holders = await this.prisma.userPersona.findMany({
      where: { personaId: granteeId, status: 'ACTIVE' },
      select: { userId: true },
    });
    for (const h of holders) this.permissions.bust(h.userId);
  }
}
