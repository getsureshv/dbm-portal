import {
  PrismaClient,
  PersonaBaseType,
  PermissionScope,
  UserPersonaStatus,
} from '@prisma/client';

/**
 * Persona & Access Management seed (idempotent — runs on every deploy).
 *
 * Seeds, in order:
 *   1. Entity registry (resource types that can be permissioned).
 *   2. The 7 system/seed personas + their permission matrices.
 *   3. Back-fills a UserPersona row for every existing user, derived from the
 *      legacy User.role / User.providerType columns (kept during the build).
 *
 * Spec: DBM-persona-access-module-spec.md §3.2, §4, FR-10. The legacy enum
 * columns remain authoritative for the live app until the module is wired up;
 * this seed only POPULATES the new tables, it does not remove anything.
 */

// ─── Entity registry ─────────────────────────────────────────
// ownerField resolves scope:own; participantSource resolves scope:assigned.
// Only `project` has real owner/participant wiring today; the rest are
// registered so the admin matrix lists them and future modules can use them.
const ENTITIES: Array<{
  key: string;
  label: string;
  actions: string[];
  supportsRecordGrants: boolean;
  ownerField: string | null;
  participantSource: string | null;
}> = [
  {
    key: 'project',
    label: 'Projects',
    actions: ['create', 'read', 'update', 'delete'],
    supportsRecordGrants: true,
    ownerField: 'ownerId',
    participantSource: 'project_invitations',
  },
  {
    key: 'bid',
    label: 'Bids',
    actions: ['create', 'read', 'update', 'delete', 'submit'],
    supportsRecordGrants: true,
    ownerField: 'providerId',
    participantSource: null,
  },
  {
    key: 'contract',
    label: 'Contracts',
    actions: ['create', 'read', 'update', 'delete', 'sign'],
    supportsRecordGrants: true,
    ownerField: 'ownerId',
    participantSource: 'contract_parties',
  },
  {
    key: 'document',
    label: 'Documents',
    actions: ['create', 'read', 'update', 'delete'],
    supportsRecordGrants: true,
    ownerField: 'uploadedById',
    participantSource: null,
  },
  {
    key: 'rfi',
    label: 'RFIs',
    actions: ['create', 'read', 'update', 'respond', 'close'],
    supportsRecordGrants: true,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'submittal',
    label: 'Submittals',
    actions: ['create', 'read', 'update', 'approve', 'reject'],
    supportsRecordGrants: true,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'invoice',
    label: 'Invoices',
    actions: ['create', 'read', 'update', 'delete'],
    supportsRecordGrants: true,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'change_order',
    label: 'Change Orders',
    actions: ['create', 'read', 'update', 'approve', 'reject'],
    supportsRecordGrants: true,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'persona',
    label: 'Personas',
    actions: ['create', 'read', 'update', 'archive'],
    supportsRecordGrants: false,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'user_access',
    label: 'User Access',
    actions: ['read', 'assign', 'revoke', 'approve', 'grant'],
    supportsRecordGrants: false,
    ownerField: null,
    participantSource: null,
  },
  {
    key: 'audit',
    label: 'Audit Log',
    actions: ['read'],
    supportsRecordGrants: false,
    ownerField: null,
    participantSource: null,
  },
];

// ─── Persona definitions ─────────────────────────────────────
// Initial matrices. Admin can edit these afterwards via the matrix UI.
type PermDef = { entity: string; actions: string[]; scope: PermissionScope };
type PersonaDef = {
  slug: string;
  name: string;
  description: string;
  baseType: PersonaBaseType;
  isSystem: boolean;
  requiresApproval: boolean;
  permissions: PermDef[];
};

const ALL = PermissionScope.ALL;
const OWN = PermissionScope.OWN;
const ASSIGNED = PermissionScope.ASSIGNED;

const PERSONAS: PersonaDef[] = [
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Platform administrator. Manages personas, access, and audit.',
    baseType: PersonaBaseType.ADMIN,
    isSystem: true,
    requiresApproval: false,
    permissions: [
      { entity: 'project', actions: ['create', 'read', 'update', 'delete'], scope: ALL },
      { entity: 'bid', actions: ['read', 'update', 'delete'], scope: ALL },
      { entity: 'contract', actions: ['read', 'update', 'delete'], scope: ALL },
      { entity: 'document', actions: ['create', 'read', 'update', 'delete'], scope: ALL },
      { entity: 'rfi', actions: ['read', 'update', 'respond', 'close'], scope: ALL },
      { entity: 'submittal', actions: ['read', 'update', 'approve', 'reject'], scope: ALL },
      { entity: 'invoice', actions: ['create', 'read', 'update', 'delete'], scope: ALL },
      { entity: 'change_order', actions: ['read', 'update', 'approve', 'reject'], scope: ALL },
      // The Admin persona must always retain persona:update (no lock-out, FR-6).
      { entity: 'persona', actions: ['create', 'read', 'update', 'archive'], scope: ALL },
      { entity: 'user_access', actions: ['read', 'assign', 'revoke', 'approve', 'grant'], scope: ALL },
      { entity: 'audit', actions: ['read'], scope: ALL },
    ],
  },
  {
    slug: 'client',
    name: 'Client',
    description: 'Homeowner / project owner. Sees and manages their own projects.',
    baseType: PersonaBaseType.CLIENT,
    isSystem: true,
    requiresApproval: false,
    permissions: [
      { entity: 'project', actions: ['create', 'read', 'update', 'delete'], scope: OWN },
      { entity: 'bid', actions: ['read'], scope: ASSIGNED },
      { entity: 'contract', actions: ['read', 'sign'], scope: ASSIGNED },
      { entity: 'document', actions: ['create', 'read', 'update', 'delete'], scope: OWN },
      { entity: 'rfi', actions: ['create', 'read', 'respond'], scope: ASSIGNED },
      { entity: 'change_order', actions: ['read', 'approve', 'reject'], scope: ASSIGNED },
      { entity: 'invoice', actions: ['read'], scope: ASSIGNED },
    ],
  },
  {
    slug: 'planning-design-professional',
    name: 'Planning & Design Professional',
    description: 'Architect, engineer, designer. Participates in assigned projects.',
    baseType: PersonaBaseType.PROFESSIONAL,
    isSystem: false,
    requiresApproval: true,
    permissions: [
      { entity: 'project', actions: ['read'], scope: ASSIGNED },
      { entity: 'bid', actions: ['create', 'read', 'update', 'submit'], scope: OWN },
      { entity: 'contract', actions: ['read', 'sign'], scope: ASSIGNED },
      { entity: 'document', actions: ['create', 'read', 'update'], scope: ASSIGNED },
      { entity: 'rfi', actions: ['create', 'read', 'respond'], scope: ASSIGNED },
      { entity: 'submittal', actions: ['create', 'read', 'update'], scope: ASSIGNED },
    ],
  },
  {
    slug: 'general-contractor',
    name: 'General Contractor',
    description: 'GC bidding on and executing assigned projects.',
    baseType: PersonaBaseType.PROFESSIONAL,
    isSystem: false,
    requiresApproval: true,
    permissions: [
      { entity: 'project', actions: ['read'], scope: ASSIGNED },
      { entity: 'bid', actions: ['create', 'read', 'update', 'submit'], scope: OWN },
      { entity: 'contract', actions: ['read', 'sign'], scope: ASSIGNED },
      { entity: 'document', actions: ['create', 'read', 'update'], scope: ASSIGNED },
      { entity: 'rfi', actions: ['create', 'read', 'respond', 'close'], scope: ASSIGNED },
      { entity: 'submittal', actions: ['create', 'read', 'update'], scope: ASSIGNED },
      { entity: 'change_order', actions: ['create', 'read', 'update'], scope: ASSIGNED },
      { entity: 'invoice', actions: ['create', 'read', 'update'], scope: OWN },
    ],
  },
  {
    slug: 'supplier',
    name: 'Supplier',
    description: 'Materials supplier. Quotes and supplies to assigned projects.',
    baseType: PersonaBaseType.SUPPLIER,
    isSystem: false,
    requiresApproval: true,
    permissions: [
      { entity: 'project', actions: ['read'], scope: ASSIGNED },
      { entity: 'bid', actions: ['create', 'read', 'update', 'submit'], scope: OWN },
      { entity: 'document', actions: ['read'], scope: ASSIGNED },
      { entity: 'invoice', actions: ['create', 'read', 'update'], scope: OWN },
    ],
  },
  {
    slug: 'freight',
    name: 'Freight',
    description: 'Freight / logistics provider for material delivery.',
    baseType: PersonaBaseType.FREIGHT,
    isSystem: false,
    requiresApproval: true,
    permissions: [
      { entity: 'project', actions: ['read'], scope: ASSIGNED },
      { entity: 'bid', actions: ['create', 'read', 'update', 'submit'], scope: OWN },
      { entity: 'document', actions: ['read'], scope: ASSIGNED },
      { entity: 'invoice', actions: ['create', 'read', 'update'], scope: OWN },
    ],
  },
  {
    slug: 'service-provider',
    name: 'Service Provider',
    description: 'Specialty services (testing, cleaning, rental, etc.).',
    baseType: PersonaBaseType.SERVICE_PROVIDER,
    isSystem: false,
    requiresApproval: true,
    permissions: [
      { entity: 'project', actions: ['read'], scope: ASSIGNED },
      { entity: 'bid', actions: ['create', 'read', 'update', 'submit'], scope: OWN },
      { entity: 'document', actions: ['read'], scope: ASSIGNED },
      { entity: 'invoice', actions: ['create', 'read', 'update'], scope: OWN },
    ],
  },
];

/**
 * Map a legacy (role, providerType) pair to the seed persona slug it should
 * back-fill into. Mirrors the current single-role model.
 */
function legacyPersonaSlug(
  role: string | null,
  providerType: string | null,
): string | null {
  if (role === 'ADMIN') return 'admin';
  if (role === 'OWNER') return 'client';
  if (role === 'PROVIDER') {
    switch (providerType) {
      case 'PROFESSIONAL':
        // Default professionals to the P&D persona; GCs can be reassigned by
        // an admin. (Legacy model can't distinguish the two.)
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

export async function seedPersonas(prisma: PrismaClient): Promise<void> {
  // 1. Entity registry.
  for (const e of ENTITIES) {
    await prisma.entity.upsert({
      where: { key: e.key },
      update: {
        label: e.label,
        actions: e.actions,
        supportsRecordGrants: e.supportsRecordGrants,
        ownerField: e.ownerField,
        participantSource: e.participantSource,
      },
      create: {
        key: e.key,
        label: e.label,
        actions: e.actions,
        supportsRecordGrants: e.supportsRecordGrants,
        ownerField: e.ownerField,
        participantSource: e.participantSource,
      },
    });
  }
  console.log(`✓ Seeded ${ENTITIES.length} permissionable entities`);

  // 2. Personas + permission matrices.
  for (const p of PERSONAS) {
    const persona = await prisma.persona.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        baseType: p.baseType,
        isSystem: p.isSystem,
        requiresApproval: p.requiresApproval,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        baseType: p.baseType,
        isSystem: p.isSystem,
        requiresApproval: p.requiresApproval,
      },
    });

    // Replace this persona's permission matrix idempotently.
    for (const perm of p.permissions) {
      await prisma.personaPermission.upsert({
        where: {
          personaId_entityKey: {
            personaId: persona.id,
            entityKey: perm.entity,
          },
        },
        update: { actions: perm.actions, scope: perm.scope },
        create: {
          personaId: persona.id,
          entityKey: perm.entity,
          actions: perm.actions,
          scope: perm.scope,
        },
      });
    }
  }
  console.log(`✓ Seeded ${PERSONAS.length} personas with permission matrices`);

  // 3. Back-fill UserPersona for every existing user from legacy role columns.
  const slugToId = new Map<string, string>();
  for (const p of await prisma.persona.findMany({ select: { id: true, slug: true } })) {
    slugToId.set(p.slug, p.id);
  }

  const users = await prisma.user.findMany({
    select: { id: true, role: true, providerType: true },
  });

  let backfilled = 0;
  for (const u of users) {
    const slug = legacyPersonaSlug(
      u.role as string | null,
      u.providerType as string | null,
    );
    if (!slug) continue;
    const personaId = slugToId.get(slug);
    if (!personaId) continue;

    await prisma.userPersona.upsert({
      where: { userId_personaId: { userId: u.id, personaId } },
      update: {}, // never override an admin's later edits / status changes
      create: {
        userId: u.id,
        personaId,
        status: UserPersonaStatus.ACTIVE, // existing users are already active
      },
    });
    backfilled++;
  }
  console.log(`✓ Back-filled ${backfilled} user-persona assignments`);
}
