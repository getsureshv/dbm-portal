import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

/**
 * Regression coverage for the access bug where getProject() enforced a bare
 * `project.ownerId === userId` check, ignoring record grants and admin scope —
 * so a user the owner had explicitly shared a project with was told "Not
 * authorized to access this project". getProject now delegates to the central
 * permission engine (PermissionsService.can) for read/update/delete.
 */

const OWNER = 'owner-user-id';
const GRANTEE = 'grantee-user-id';
const STRANGER = 'stranger-user-id';
const PROJECT_ID = '2c8d8144-642c-4a1e-b2b0-3c3949cb9f74';

function makeService(opts: {
  /** decides what permissions.can() returns, keyed by `${userId}:${action}` */
  allow: (userId: string, action: string) => boolean;
  project?: any;
}) {
  const project =
    opts.project === undefined
      ? { id: PROJECT_ID, ownerId: OWNER, documents: [], scopeDocument: null }
      : opts.project;

  const prisma: any = {
    project: {
      findUnique: jest.fn().mockResolvedValue(project),
      update: jest.fn().mockResolvedValue({ ...project, deletedAt: new Date() }),
    },
    projectDocument: { create: jest.fn().mockResolvedValue({ id: 'doc1' }) },
  };
  const permissions: any = {
    can: jest.fn((userId: string, action: string) =>
      Promise.resolve(opts.allow(userId, action)),
    ),
  };
  const svc = new ProjectsService(prisma, permissions);
  return { svc, prisma, permissions };
}

describe('ProjectsService.getProject access control', () => {
  it('allows the OWNER to read their project', async () => {
    const { svc } = makeService({ allow: (u) => u === OWNER });
    const p = await svc.getProject(PROJECT_ID, OWNER);
    expect(p.id).toBe(PROJECT_ID);
  });

  it('allows a GRANTEE (shared via record grant) to read — the bug fix', async () => {
    // engine returns true for the grantee's read because of the record grant
    const { svc, permissions } = makeService({
      allow: (u, a) => (u === OWNER) || (u === GRANTEE && a === 'read'),
    });
    const p = await svc.getProject(PROJECT_ID, GRANTEE);
    expect(p.id).toBe(PROJECT_ID);
    expect(permissions.can).toHaveBeenCalledWith(
      GRANTEE,
      'read',
      'project',
      expect.objectContaining({ id: PROJECT_ID, ownerId: OWNER }),
    );
  });

  it('denies a stranger with no grant (Forbidden)', async () => {
    const { svc } = makeService({ allow: (u) => u === OWNER });
    await expect(svc.getProject(PROJECT_ID, STRANGER)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns 404 when the project does not exist (before any auth check)', async () => {
    const { svc, permissions } = makeService({ allow: () => true, project: null });
    await expect(svc.getProject(PROJECT_ID, OWNER)).rejects.toThrow(
      NotFoundException,
    );
    expect(permissions.can).not.toHaveBeenCalled();
  });

  it('update path authorizes for the UPDATE action, not read', async () => {
    const calls: string[] = [];
    const { svc } = makeService({
      allow: (u, a) => {
        calls.push(a);
        return u === GRANTEE && a === 'update';
      },
    });
    await svc.updateProject(PROJECT_ID, GRANTEE, { title: 'x' } as any);
    expect(calls).toContain('update');
  });

  it('read-only grantee is BLOCKED from updating (engine denies update)', async () => {
    const { svc } = makeService({
      allow: (u, a) => u === GRANTEE && a === 'read', // read only, no update
    });
    await expect(
      svc.updateProject(PROJECT_ID, GRANTEE, { title: 'x' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('delete path authorizes for the DELETE action', async () => {
    const calls: string[] = [];
    const { svc } = makeService({
      allow: (u, a) => {
        calls.push(a);
        return u === OWNER && a === 'delete';
      },
    });
    await svc.deleteProject(PROJECT_ID, OWNER);
    expect(calls).toContain('delete');
  });

  it('addDocument requires UPDATE access (read-only grantee blocked)', async () => {
    const { svc } = makeService({
      allow: (u, a) => u === GRANTEE && a === 'read',
    });
    await expect(
      svc.addDocument(PROJECT_ID, GRANTEE, 's3key', 'f.pdf', 'TECHNICAL'),
    ).rejects.toThrow(ForbiddenException);
  });
});
