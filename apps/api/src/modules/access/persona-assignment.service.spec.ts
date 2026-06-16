import { PersonaAssignmentService } from './persona-assignment.service';

/**
 * Unit tests for PersonaAssignmentService (PR4, FR-1…FR-5):
 *  - slugFor mapping for every (role, providerType) pair
 *  - PENDING for personas requiring approval, ACTIVE otherwise
 *  - idempotent: never downgrades an existing assignment
 *  - cache is busted on assignment
 *  - approve() flips PENDING → ACTIVE and busts cache
 *
 * Prisma + PermissionsService are mocked.
 */

function mockPrisma(overrides: any = {}) {
  const base: any = {
    persona: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    userPersona: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
  // $transaction(cb) runs the callback with the same client (the mock itself).
  base.$transaction = jest.fn((cb: any) => cb(base));
  return base as any;
}

function mockPermissions() {
  return { bust: jest.fn() } as any;
}

function mockAudit() {
  return { record: jest.fn().mockResolvedValue({}) } as any;
}

describe('PersonaAssignmentService.slugFor', () => {
  it('maps ADMIN → admin', () => {
    expect(PersonaAssignmentService.slugFor('ADMIN', null)).toBe('admin');
  });

  it('maps OWNER → client', () => {
    expect(PersonaAssignmentService.slugFor('OWNER', null)).toBe('client');
  });

  it('maps PROVIDER+PROFESSIONAL → planning-design-professional', () => {
    expect(PersonaAssignmentService.slugFor('PROVIDER', 'PROFESSIONAL')).toBe(
      'planning-design-professional',
    );
  });

  it('maps PROVIDER+SUPPLIER → supplier', () => {
    expect(PersonaAssignmentService.slugFor('PROVIDER', 'SUPPLIER')).toBe('supplier');
  });

  it('maps PROVIDER+FREIGHT → freight', () => {
    expect(PersonaAssignmentService.slugFor('PROVIDER', 'FREIGHT')).toBe('freight');
  });

  it('returns null for PROVIDER with no/unknown providerType', () => {
    expect(PersonaAssignmentService.slugFor('PROVIDER', null)).toBeNull();
    expect(PersonaAssignmentService.slugFor('PROVIDER', 'WAT')).toBeNull();
  });

  it('returns null for unknown role', () => {
    expect(PersonaAssignmentService.slugFor(null, null)).toBeNull();
    expect(PersonaAssignmentService.slugFor('GUEST', null)).toBeNull();
  });
});

describe('PersonaAssignmentService.assignFromRole', () => {
  it('assigns ACTIVE for a persona that does not require approval (client)', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p-client',
          slug: 'client',
          requiresApproval: false,
          status: 'ACTIVE',
        }),
      },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new PersonaAssignmentService(prisma, perms, audit);

    const res = await svc.assignFromRole('u1', 'OWNER', null);

    expect(res).toEqual({ personaSlug: 'client', status: 'ACTIVE' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_persona.assigned' }),
      prisma,
    );
    expect(prisma.userPersona.create).toHaveBeenCalledWith({
      data: { userId: 'u1', personaId: 'p-client', status: 'ACTIVE' },
    });
    expect(perms.bust).toHaveBeenCalledWith('u1');
  });

  it('assigns PENDING for a persona that requires approval (provider)', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p-prof',
          slug: 'planning-design-professional',
          requiresApproval: true,
          status: 'ACTIVE',
        }),
      },
    });
    const perms = mockPermissions();
    const svc = new PersonaAssignmentService(prisma, perms, mockAudit());

    const res = await svc.assignFromRole('u2', 'PROVIDER', 'PROFESSIONAL');

    expect(res).toEqual({
      personaSlug: 'planning-design-professional',
      status: 'PENDING',
    });
    expect(prisma.userPersona.create).toHaveBeenCalledWith({
      data: { userId: 'u2', personaId: 'p-prof', status: 'PENDING' },
    });
  });

  it('returns null and no-ops when role/providerType maps to no persona', async () => {
    const prisma = mockPrisma();
    const perms = mockPermissions();
    const svc = new PersonaAssignmentService(prisma, perms, mockAudit());

    const res = await svc.assignFromRole('u3', 'PROVIDER', null);

    expect(res).toBeNull();
    expect(prisma.persona.findUnique).not.toHaveBeenCalled();
    expect(prisma.userPersona.create).not.toHaveBeenCalled();
    expect(perms.bust).not.toHaveBeenCalled();
  });

  it('returns null if the mapped persona is missing or not ACTIVE', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p-x',
          slug: 'supplier',
          requiresApproval: true,
          status: 'ARCHIVED',
        }),
      },
    });
    const svc = new PersonaAssignmentService(prisma, mockPermissions(), mockAudit());
    const res = await svc.assignFromRole('u4', 'PROVIDER', 'SUPPLIER');
    expect(res).toBeNull();
    expect(prisma.userPersona.create).not.toHaveBeenCalled();
  });

  it('is idempotent: does NOT downgrade or recreate an existing assignment', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p-prof',
          slug: 'planning-design-professional',
          requiresApproval: true,
          status: 'ACTIVE',
        }),
      },
      userPersona: {
        // admin already approved this provider → ACTIVE
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const perms = mockPermissions();
    const svc = new PersonaAssignmentService(prisma, perms, mockAudit());

    const res = await svc.assignFromRole('u5', 'PROVIDER', 'PROFESSIONAL');

    // reports the EXISTING status, never recreates / downgrades to PENDING
    expect(res).toEqual({
      personaSlug: 'planning-design-professional',
      status: 'ACTIVE',
    });
    expect(prisma.userPersona.create).not.toHaveBeenCalled();
  });
});

describe('PersonaAssignmentService.adminAssign', () => {
  it('creates an ACTIVE assignment with assignedBy/expiry and audits it', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-sup', status: 'ACTIVE' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u7' }) },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new PersonaAssignmentService(prisma, perms, audit);

    await svc.adminAssign('u7', 'p-sup', { expiresAt: '2026-12-31T00:00:00Z' }, 'admin1');

    expect(prisma.userPersona.create).toHaveBeenCalledWith({
      data: {
        userId: 'u7',
        personaId: 'p-sup',
        status: 'ACTIVE',
        assignedBy: 'admin1',
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_persona.admin_assigned' }),
      prisma,
    );
    expect(perms.bust).toHaveBeenCalledWith('u7');
  });

  it('is idempotent: returns the existing row without recreating', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-sup', status: 'ACTIVE' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u7' }) },
      userPersona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'up1', status: 'ACTIVE' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const svc = new PersonaAssignmentService(prisma, mockPermissions(), mockAudit());
    const res = await svc.adminAssign('u7', 'p-sup', {}, 'admin1');
    expect(res).toEqual({ id: 'up1', status: 'ACTIVE' });
    expect(prisma.userPersona.create).not.toHaveBeenCalled();
  });

  it('throws if the persona is missing or archived', async () => {
    const prisma = mockPrisma({
      persona: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new PersonaAssignmentService(prisma, mockPermissions(), mockAudit());
    await expect(svc.adminAssign('u7', 'gone', {}, 'admin1')).rejects.toThrow();
  });

  it('throws if the user does not exist', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-sup', status: 'ACTIVE' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new PersonaAssignmentService(prisma, mockPermissions(), mockAudit());
    await expect(svc.adminAssign('ghost', 'p-sup', {}, 'admin1')).rejects.toThrow();
  });
});

describe('PersonaAssignmentService.revoke', () => {
  it('flips an ACTIVE assignment to REVOKED, audits, and busts cache', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'up1', status: 'ACTIVE' }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'up1', status: 'REVOKED' }),
      },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new PersonaAssignmentService(prisma, perms, audit);

    const res = await svc.revoke('u8', 'p-sup', 'admin1');

    expect(res).toEqual({ userId: 'u8', personaId: 'p-sup', status: 'REVOKED' });
    expect(prisma.userPersona.update).toHaveBeenCalledWith({
      where: { userId_personaId: { userId: 'u8', personaId: 'p-sup' } },
      data: { status: 'REVOKED' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_persona.revoked' }),
      prisma,
    );
    expect(perms.bust).toHaveBeenCalledWith('u8');
  });

  it('is a no-op if already REVOKED (no update, no bust)', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'up1', status: 'REVOKED' }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const perms = mockPermissions();
    const svc = new PersonaAssignmentService(prisma, perms, mockAudit());
    await svc.revoke('u8', 'p-sup', 'admin1');
    expect(prisma.userPersona.update).not.toHaveBeenCalled();
    expect(perms.bust).not.toHaveBeenCalled();
  });

  it('throws if the assignment does not exist', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const svc = new PersonaAssignmentService(prisma, mockPermissions(), mockAudit());
    await expect(svc.revoke('u8', 'nope', 'admin1')).rejects.toThrow();
  });
});

describe('PersonaAssignmentService.approve', () => {
  it('flips an assignment to ACTIVE and busts the cache', async () => {
    const prisma = mockPrisma();
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new PersonaAssignmentService(prisma, perms, audit);

    await svc.approve('u6', 'p-prof', 'admin1');

    expect(prisma.userPersona.update).toHaveBeenCalledWith({
      where: { userId_personaId: { userId: 'u6', personaId: 'p-prof' } },
      data: { status: 'ACTIVE' },
    });
    expect(perms.bust).toHaveBeenCalledWith('u6');
  });
});
