import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from './permissions.service';

/**
 * PersonaAssignmentService (PR4) — turns a user's chosen role/providerType into
 * a persona assignment at registration/onboarding time (FR-1…FR-5).
 *
 *  - Maps (role, providerType) → seed persona slug (same map as the seed
 *    back-fill, kept in sync deliberately during the legacy-coexistence phase).
 *  - Creates a UserPersona. If the persona `requiresApproval` (providers), it
 *    lands PENDING and must be approved by an admin before it grants access
 *    (FR-5). Client/Admin personas are ACTIVE immediately.
 *  - Idempotent: never downgrades an existing assignment (an admin may have
 *    already approved/edited it). Busts the permissions cache so the new
 *    persona is reflected within the request, not after the ≤5min TTL.
 *
 * This is additive: it only writes UserPersona rows. Legacy role columns stay
 * authoritative for the live app until the final cleanup PR, and the
 * PermissionsService legacy fallback covers any user not yet assigned.
 */
@Injectable()
export class PersonaAssignmentService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  /** Map a (role, providerType) pair to the seed persona slug. */
  static slugFor(role: string | null, providerType: string | null): string | null {
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
   * Assign the persona that matches a user's role/providerType.
   * Returns the resulting assignment summary, or null if no persona maps
   * (e.g. an unrecognized provider type) so callers can no-op gracefully.
   */
  async assignFromRole(
    userId: string,
    role: string | null,
    providerType: string | null,
  ): Promise<{ personaSlug: string; status: string } | null> {
    const slug = PersonaAssignmentService.slugFor(role, providerType);
    if (!slug) return null;

    const persona = await this.prisma.persona.findUnique({
      where: { slug },
      select: { id: true, slug: true, requiresApproval: true, status: true },
    });
    if (!persona || persona.status !== 'ACTIVE') return null;

    const status: 'ACTIVE' | 'PENDING' = persona.requiresApproval
      ? 'PENDING'
      : 'ACTIVE';

    // Idempotent create — do NOT override an existing row (admin edits win).
    const existing = await this.prisma.userPersona.findUnique({
      where: { userId_personaId: { userId, personaId: persona.id } },
      select: { status: true },
    });

    if (!existing) {
      await this.prisma.userPersona.create({
        data: { userId, personaId: persona.id, status },
      });
    }

    this.permissions.bust(userId);
    return { personaSlug: persona.slug, status: existing?.status ?? status };
  }

  /** Admin approves a PENDING assignment → ACTIVE (FR-5). Busts cache. */
  async approve(userId: string, personaId: string): Promise<void> {
    await this.prisma.userPersona.update({
      where: { userId_personaId: { userId, personaId } },
      data: { status: 'ACTIVE' },
    });
    this.permissions.bust(userId);
  }
}
