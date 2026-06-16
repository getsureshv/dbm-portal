import { PermissionsService } from './permissions.service';

/**
 * Loader-level tests for PermissionsService: context loading + ≤5min cache
 * (FR-15.1), legacy-role fallback (transitional safety net), record resolution
 * for OWN scope, and lazy-expiry filters being applied.
 *
 * Prisma is mocked; the pure engine is exercised through check().
 */

function mockPrisma(overrides: any = {}) {
  return {
    userPersona: { findMany: jest.fn().mockResolvedValue([]) },
    recordGrant: { findMany: jest.fn().mockResolvedValue([]) },
    persona: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    project: { findUnique: jest.fn().mockResolvedValue(null) },
    projectDocument: { findUnique: jest.fn().mockResolvedValue(null) },
    ...overrides,
  } as any;
}

const clientPersonaRow = {
  persona: {
    id: 'persona-client',
    slug: 'client',
    status: 'ACTIVE',
    permissions: [
      { entityKey: 'project', actions: ['read', 'update', 'delete'], scope: 'OWN' },
      { entityKey: 'project', actions: ['create'], scope: 'OWN' },
    ],
  },
};

describe('PermissionsService.getContext', () => {
  it('loads active personas and flattens their matrices', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findMany: jest.fn().mockResolvedValue([clientPersonaRow]),
      },
    });
    const svc = new PermissionsService(prisma);
    const ctx = await svc.getContext('u1');
    expect(ctx.personas).toHaveLength(1);
    expect(ctx.personas[0].slug).toBe('client');
    expect(ctx.personas[0].permissions[0]).toMatchObject({ entity: 'project', scope: 'OWN' });
  });

  it('caches context for the same user (no second DB hit within TTL)', async () => {
    const findMany = jest.fn().mockResolvedValue([clientPersonaRow]);
    const prisma = mockPrisma({ userPersona: { findMany } });
    const svc = new PermissionsService(prisma);
    await svc.getContext('u1');
    await svc.getContext('u1');
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('bust() forces a reload', async () => {
    const findMany = jest.fn().mockResolvedValue([clientPersonaRow]);
    const prisma = mockPrisma({ userPersona: { findMany } });
    const svc = new PermissionsService(prisma);
    await svc.getContext('u1');
    svc.bust('u1');
    await svc.getContext('u1');
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('falls back to legacy role when the user has no UserPersona rows', async () => {
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'OWNER', providerType: null }),
      },
      persona: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'persona-client',
          slug: 'client',
          status: 'ACTIVE',
          permissions: [
            { entityKey: 'project', actions: ['read'], scope: 'OWN' },
          ],
        }),
      },
    });
    const svc = new PermissionsService(prisma);
    const ctx = await svc.getContext('legacy-owner');
    expect(ctx.personas.map((p) => p.slug)).toEqual(['client']);
  });

  it('no personas and no legacy role → empty context (deny by default)', async () => {
    const prisma = mockPrisma({
      user: { findUnique: jest.fn().mockResolvedValue({ role: null, providerType: null }) },
    });
    const svc = new PermissionsService(prisma);
    const ctx = await svc.getContext('nobody');
    expect(ctx.personas).toHaveLength(0);
    expect(ctx.grants).toHaveLength(0);
  });
});

describe('PermissionsService.check (404/403 inputs)', () => {
  it('owner reading own project → allowed', async () => {
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([clientPersonaRow]) },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', ownerId: 'u1' }),
      },
    });
    const svc = new PermissionsService(prisma);
    const { decision, recordMissing } = await svc.check('u1', 'read', 'project', 'p1');
    expect(decision.allowed).toBe(true);
    expect(recordMissing).toBe(false);
  });

  it("client reading someone else's project → denied (scope-not-satisfied)", async () => {
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([clientPersonaRow]) },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p2', ownerId: 'other' }),
      },
    });
    const svc = new PermissionsService(prisma);
    const { decision } = await svc.check('u1', 'read', 'project', 'p2');
    expect(decision.allowed).toBe(false);
  });

  it('missing record → recordMissing true (guard turns into 404)', async () => {
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([clientPersonaRow]) },
      project: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = new PermissionsService(prisma);
    const { recordMissing } = await svc.check('u1', 'read', 'project', 'ghost');
    expect(recordMissing).toBe(true);
  });

  it('create path does not resolve a record', async () => {
    const findUnique = jest.fn();
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([clientPersonaRow]) },
      project: { findUnique },
    });
    const svc = new PermissionsService(prisma);
    const { decision } = await svc.check('u1', 'create', 'project');
    expect(decision.allowed).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('recordless list read (GET /projects) → allowed for OWN persona, no record resolved', async () => {
    const findUnique = jest.fn();
    const prisma = mockPrisma({
      userPersona: { findMany: jest.fn().mockResolvedValue([clientPersonaRow]) },
      project: { findUnique },
    });
    const svc = new PermissionsService(prisma);
    const { decision, recordMissing } = await svc.check('u1', 'read', 'project');
    expect(decision.allowed).toBe(true); // collection read passes the guard
    expect(recordMissing).toBe(false);
    expect(findUnique).not.toHaveBeenCalled(); // no single record to resolve
  });

  it('recordless list read → denied when persona lacks the entity permission', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findMany: jest.fn().mockResolvedValue([
          {
            persona: {
              id: 'persona-client',
              slug: 'client',
              status: 'ACTIVE',
              permissions: [{ entityKey: 'document', actions: ['read'], scope: 'OWN' }],
            },
          },
        ]),
      },
    });
    const svc = new PermissionsService(prisma);
    const { decision } = await svc.check('u1', 'read', 'project');
    expect(decision.allowed).toBe(false);
  });

  it('document owner resolves from its project owner, not uploader', async () => {
    const prisma = mockPrisma({
      userPersona: {
        findMany: jest.fn().mockResolvedValue([
          {
            persona: {
              id: 'persona-client',
              slug: 'client',
              status: 'ACTIVE',
              permissions: [
                { entityKey: 'document', actions: ['read'], scope: 'OWN' },
              ],
            },
          },
        ]),
      },
      projectDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          uploadedById: 'someone-else',
          project: { ownerId: 'u1' },
        }),
      },
    });
    const svc = new PermissionsService(prisma);
    const { decision } = await svc.check('u1', 'read', 'document', 'd1');
    expect(decision.allowed).toBe(true); // owner of project, even if not uploader
  });
});
