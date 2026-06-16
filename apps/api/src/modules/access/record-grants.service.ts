import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from './permissions.service';
import { AuditService } from './audit.service';

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
    private audit: AuditService,
  ) {}

  /** Issue a record grant (FR-11). Grant row + audit event commit atomically. */
  async create(input: {
    entity: string;
    recordId: string;
    granteeType: 'USER' | 'PERSONA';
    granteeId: string;
    actions: string[];
    reason: string;
    expiresAt?: string | null;
    grantedBy: string;
    /** When the caller already resolved/created the grantee, skip the lookup. */
    skipGranteeValidation?: boolean;
  }) {
    // Validate the grantee exists so we never issue a dangling grant.
    if (input.skipGranteeValidation) {
      // caller guarantees the grantee row exists (e.g. ownerGrant just created it)
    } else if (input.granteeType === 'USER') {
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

    const grant = await this.prisma.$transaction(async (tx) => {
      const g = await tx.recordGrant.create({
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
      await this.audit.record(
        {
          actorId: input.grantedBy,
          action: 'record_grant.created',
          subjectType: 'record_grant',
          subjectId: g.id,
          before: null,
          after: g,
        },
        tx,
      );
      return g;
    });

    await this.bustGrantee(input.granteeType, input.granteeId);
    return grant;
  }

  /**
   * Revoke a record grant (FR-12). Idempotent on an already-inactive grant.
   * Status flip + audit event commit atomically.
   */
  async revoke(grantId: string, actorId?: string) {
    const grant = await this.prisma.recordGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Record grant not found');

    if (grant.status === 'ACTIVE') {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.recordGrant.update({
          where: { id: grantId },
          data: { status: 'REVOKED' },
        });
        await this.audit.record(
          {
            actorId: actorId ?? null,
            action: 'record_grant.revoked',
            subjectType: 'record_grant',
            subjectId: grantId,
            before: grant,
            after: updated,
          },
          tx,
        );
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

  /**
   * Owner-facing grant on a single project (self-service delegation).
   *
   * Unlike create(), this is invoked by a project OWNER (not an admin) for one
   * of *their own* projects — the controller has already enforced, via the
   * record-level PermissionGuard (`update`@`project` with the recordId), that
   * the caller may update this specific project. Here we only:
   *   - resolve the grantee by EMAIL (owners think in emails, not user ids),
   *   - create a pending placeholder user if the email isn't registered yet
   *     (the auth login flow reconciles by email on first sign-in, attaching
   *     the real Firebase uid — see AuthService.createSession), and
   *   - clamp the granted actions to a safe owner-delegatable set (read/update
   *     only — never delete, never grant/revoke), so an owner can never use
   *     this path to escalate beyond what they hold.
   *
   * Returns { grant, invited } where `invited` is true when a placeholder user
   * was just created for a not-yet-registered email.
   */
  async ownerGrant(input: {
    recordId: string;
    granteeEmail: string;
    actions?: string[];
    reason?: string;
    expiresAt?: string | null;
    grantedBy: string;
  }): Promise<{ grant: any; invited: boolean }> {
    const email = input.granteeEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid grantee email is required');
    }

    // Clamp to the owner-delegatable action set. Owners may share read/update;
    // delete and grant/revoke are deliberately excluded so this endpoint can
    // never be used to escalate privileges or hand off ownership.
    const ALLOWED = ['read', 'update'];
    const requested = (input.actions && input.actions.length
      ? input.actions
      : ['read', 'update']
    ).map((a) => a.toLowerCase());
    const actions = requested.filter((a) => ALLOWED.includes(a));
    if (actions.length === 0) {
      throw new BadRequestException(
        'Owners can grant only "read" and/or "update" on their projects',
      );
    }

    // Resolve (or invite) the grantee.
    let grantee = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    let invited = false;
    if (!grantee) {
      // Create a pending placeholder. firebaseUid is NOT NULL + unique, so we
      // seed a deterministic placeholder keyed on the email; the login flow's
      // email-match branch swaps in the real uid on first sign-in.
      grantee = await this.prisma.user.create({
        data: {
          email,
          firebaseUid: `invite:${email}`,
          onboardingComplete: false,
          verificationStatus: false,
        },
        select: { id: true },
      });
      invited = true;
    }

    if (grantee.id === input.grantedBy) {
      throw new BadRequestException('You already own this project');
    }

    const grant = await this.create({
      entity: 'project',
      recordId: input.recordId,
      granteeType: 'USER',
      granteeId: grantee.id,
      actions,
      reason: input.reason?.trim() || `Owner shared project with ${email}`,
      expiresAt: input.expiresAt ?? null,
      grantedBy: input.grantedBy,
      skipGranteeValidation: true, // grantee resolved/created just above
    });

    return { grant, invited };
  }

  /**
   * Owner-facing list of active grants on a single project, with grantee email
   * resolved for display. The controller has already enforced (record-level
   * guard) that the caller may read/update this specific project.
   */
  async listOwnerGrants(recordId: string) {
    const grants = await this.prisma.recordGrant.findMany({
      where: { entity: 'project', recordId, granteeType: 'USER' },
      orderBy: { grantedAt: 'desc' },
    });
    const out = [] as any[];
    for (const g of grants) {
      const u = await this.prisma.user.findUnique({
        where: { id: g.granteeId },
        select: { email: true, name: true, onboardingComplete: true },
      });
      out.push({
        id: g.id,
        granteeId: g.granteeId,
        granteeEmail: u?.email ?? null,
        granteeName: u?.name ?? null,
        pendingInvite: u ? u.onboardingComplete === false : false,
        actions: g.actions,
        reason: g.reason,
        status: g.status,
        expiresAt: g.expiresAt,
        grantedAt: g.grantedAt,
      });
    }
    return out;
  }

  /**
   * Owner-facing revoke. Verifies the grant targets the given project record
   * before revoking, so an owner (who has been authorized for THIS project by
   * the controller guard) can never revoke a grant belonging to another record.
   */
  async ownerRevoke(recordId: string, grantId: string, actorId: string) {
    const grant = await this.prisma.recordGrant.findUnique({
      where: { id: grantId },
      select: { id: true, entity: true, recordId: true },
    });
    if (!grant || grant.entity !== 'project' || grant.recordId !== recordId) {
      throw new NotFoundException('Record grant not found for this project');
    }
    return this.revoke(grantId, actorId);
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
