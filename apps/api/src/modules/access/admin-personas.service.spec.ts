import { AdminPersonasService } from './admin-personas.service';

/**
 * Unit tests for AdminPersonasService (PR7, FR-6/FR-7/FR-9):
 *  - create: slug-uniqueness conflict + audit
 *  - clone: copies the matrix as a CUSTOM persona + audit
 *  - archive: system-persona block, active-holder guard (FR-9 force), cache bust
 *  - replacePermissions: entity-registry validation + admin no-lock-out (FR-6)
 *
 * Prisma, PermissionsService and AuditService are mocked.
 */

function mockPrisma(overrides: any = {}) {
  const base: any = {
    persona: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'new', slug: 'new' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', status: 'ARCHIVED' }),
    },
    personaPermission: {
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    userPersona: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    entity: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    ...overrides,
  };
  base.$transaction = jest.fn((cb: any) => cb(base));
  return base as any;
}

function mockPermissions() {
  return { bustAll: jest.fn(), effectivePermissions: jest.fn() } as any;
}

function mockAudit() {
  return { record: jest.fn().mockResolvedValue({}) } as any;
}

const REGISTRY = [
  { key: 'persona', actions: ['read', 'create', 'update'] },
  { key: 'project', actions: ['read', 'create', 'update', 'delete'] },
];

describe('AdminPersonasService.create', () => {
  it('rejects a duplicate slug', async () => {
    const prisma = mockPrisma({
      persona: { findUnique: jest.fn().mockResolvedValue({ id: 'exists' }) },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    await expect(
      svc.create({ name: 'X', slug: 'taken', baseType: 'CUSTOM' }, 'admin1'),
    ).rejects.toThrow();
  });

  it('creates a persona and writes a persona.created audit event', async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const svc = new AdminPersonasService(prisma, mockPermissions(), audit);
    await svc.create({ name: 'X', slug: 'x', baseType: 'CUSTOM' }, 'admin1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'persona.created' }),
      prisma,
    );
  });
});

describe('AdminPersonasService.clone', () => {
  it('copies the matrix into a new CUSTOM persona and audits it', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest
          .fn()
          // 1st call: source lookup; 2nd call: slug-uniqueness (null = free)
          .mockResolvedValueOnce({
            id: 'src',
            description: 'd',
            requiresApproval: true,
            permissions: [{ entityKey: 'project', actions: ['read'], scope: 'OWN' }],
          })
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({ id: 'clone', permissions: [] }),
      },
    });
    const audit = mockAudit();
    const svc = new AdminPersonasService(prisma, mockPermissions(), audit);
    await svc.clone('src', { name: 'Clone', slug: 'clone' }, 'admin1');

    const createArg = prisma.persona.create.mock.calls[0][0];
    expect(createArg.data.baseType).toBe('CUSTOM');
    expect(createArg.data.permissions.create).toEqual([
      { entityKey: 'project', actions: ['read'], scope: 'OWN' },
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'persona.cloned' }),
      prisma,
    );
  });
});

describe('AdminPersonasService.archive', () => {
  it('blocks archiving a system persona', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin', isSystem: true }),
      },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    await expect(svc.archive('admin', {}, 'admin1')).rejects.toThrow(
      /system/i,
    );
  });

  it('blocks archiving a persona with active holders unless forced (FR-9)', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', isSystem: false }),
      },
      userPersona: { count: jest.fn().mockResolvedValue(3), findMany: jest.fn() },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    await expect(svc.archive('p1', {}, 'admin1')).rejects.toThrow(/holder/i);
  });

  it('archives with force=true even with holders, audits, and busts caches', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', isSystem: false }),
        update: jest.fn().mockResolvedValue({ id: 'p1', status: 'ARCHIVED' }),
      },
      userPersona: { count: jest.fn().mockResolvedValue(3), findMany: jest.fn() },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new AdminPersonasService(prisma, perms, audit);
    await svc.archive('p1', { force: true }, 'admin1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'persona.archived' }),
      prisma,
    );
    expect(perms.bustAll).toHaveBeenCalled();
  });
});

describe('AdminPersonasService.replacePermissions', () => {
  it('rejects an unknown entity', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', slug: 'x', permissions: [] }),
      },
      entity: { findMany: jest.fn().mockResolvedValue(REGISTRY) },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    await expect(
      svc.replacePermissions(
        'p1',
        [{ entity: 'nope', actions: ['read'], scope: 'ALL' }],
        'admin1',
      ),
    ).rejects.toThrow(/unknown entity/i);
  });

  it('rejects an action not valid for the entity', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', slug: 'x', permissions: [] }),
      },
      entity: { findMany: jest.fn().mockResolvedValue(REGISTRY) },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    await expect(
      svc.replacePermissions(
        'p1',
        [{ entity: 'project', actions: ['teleport'], scope: 'ALL' }],
        'admin1',
      ),
    ).rejects.toThrow(/not valid/i);
  });

  it('enforces admin no-lock-out: admin must keep persona:update (FR-6)', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'admin', slug: 'admin', permissions: [] }),
      },
      entity: { findMany: jest.fn().mockResolvedValue(REGISTRY) },
    });
    const svc = new AdminPersonasService(prisma, mockPermissions(), mockAudit());
    // matrix omits persona:update → must be rejected
    await expect(
      svc.replacePermissions(
        'admin',
        [{ entity: 'project', actions: ['read'], scope: 'ALL' }],
        'admin1',
      ),
    ).rejects.toThrow(/lock-out/i);
  });

  it('replaces the matrix, audits, and busts caches on a valid request', async () => {
    const prisma = mockPrisma({
      persona: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', slug: 'x', permissions: [] }),
      },
      entity: { findMany: jest.fn().mockResolvedValue(REGISTRY) },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new AdminPersonasService(prisma, perms, audit);
    await svc.replacePermissions(
      'p1',
      [{ entity: 'project', actions: ['read', 'update'], scope: 'OWN' }],
      'admin1',
    );
    expect(prisma.personaPermission.deleteMany).toHaveBeenCalledWith({
      where: { personaId: 'p1' },
    });
    expect(prisma.personaPermission.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'persona.permissions_replaced' }),
      prisma,
    );
    expect(perms.bustAll).toHaveBeenCalled();
  });
});
