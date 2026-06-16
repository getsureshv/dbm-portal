import { NotFoundException } from '@nestjs/common';
import { RecordGrantsService } from './record-grants.service';

/**
 * Unit tests for RecordGrantsService (PR5, FR-11…FR-13, FR-18):
 *  - create(): validates grantee, persists grant, busts the grantee's cache;
 *    PERSONA grants bust every active holder
 *  - revoke(): flips ACTIVE→REVOKED and busts cache; idempotent on inactive
 *  - expireOverdue(): flips past-due ACTIVE rows to EXPIRED and busts all
 *  - whoCanAccess(): reports OWNER + PERSONA_SCOPE + GRANT sources
 *
 * Prisma + PermissionsService are mocked.
 */

function mockPrisma(overrides: any = {}) {
  const base: any = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    persona: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    userPersona: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    recordGrant: {
      create: jest.fn().mockResolvedValue({ id: 'g1' }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'g1', status: 'REVOKED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
  // $transaction(cb) runs the callback with the same client (the mock itself).
  base.$transaction = jest.fn((cb: any) => cb(base));
  return base as any;
}

function mockAudit() {
  return { record: jest.fn().mockResolvedValue({}) } as any;
}

function mockPermissions(overrides: any = {}) {
  return {
    bust: jest.fn(),
    bustAll: jest.fn(),
    resolveRecord: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as any;
}

describe('RecordGrantsService.create', () => {
  it('issues a USER grant and busts that user', async () => {
    const prisma = mockPrisma({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new RecordGrantsService(prisma, perms, audit);

    const res = await svc.create({
      entity: 'project',
      recordId: 'p1',
      granteeType: 'USER',
      granteeId: 'u1',
      actions: ['read'],
      reason: 'inspector needs read',
      expiresAt: null,
      grantedBy: 'admin1',
    });

    expect(res).toEqual({ id: 'g1' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'record_grant.created' }),
      prisma,
    );
    expect(prisma.recordGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'project',
        recordId: 'p1',
        granteeType: 'USER',
        granteeId: 'u1',
        actions: ['read'],
        reason: 'inspector needs read',
        grantedBy: 'admin1',
        expiresAt: null,
        status: 'ACTIVE',
      }),
    });
    expect(perms.bust).toHaveBeenCalledWith('u1');
  });

  it('rejects a grant to a non-existent user', async () => {
    const svc = new RecordGrantsService(mockPrisma(), mockPermissions(), mockAudit());
    await expect(
      svc.create({
        entity: 'project',
        recordId: 'p1',
        granteeType: 'USER',
        granteeId: 'ghost',
        actions: ['read'],
        reason: 'x',
        grantedBy: 'admin1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('PERSONA grant busts every active holder', async () => {
    const prisma = mockPrisma({
      persona: { findUnique: jest.fn().mockResolvedValue({ id: 'per1' }), findMany: jest.fn() },
      userPersona: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]),
        updateMany: jest.fn(),
      },
    });
    const perms = mockPermissions();
    const svc = new RecordGrantsService(prisma, perms, mockAudit());

    await svc.create({
      entity: 'project',
      recordId: 'p1',
      granteeType: 'PERSONA',
      granteeId: 'per1',
      actions: ['read'],
      reason: 'all freight need read',
      grantedBy: 'admin1',
    });

    expect(perms.bust).toHaveBeenCalledWith('a');
    expect(perms.bust).toHaveBeenCalledWith('b');
  });
});

describe('RecordGrantsService.revoke', () => {
  it('flips ACTIVE → REVOKED and busts the grantee', async () => {
    const prisma = mockPrisma({
      recordGrant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'g1',
          status: 'ACTIVE',
          granteeType: 'USER',
          granteeId: 'u1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const perms = mockPermissions();
    const audit = mockAudit();
    const svc = new RecordGrantsService(prisma, perms, audit);

    const res = await svc.revoke('g1', 'admin1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'record_grant.revoked' }),
      prisma,
    );
    expect(prisma.recordGrant.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { status: 'REVOKED' },
    });
    expect(perms.bust).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ id: 'g1', status: 'REVOKED' });
  });

  it('is a no-op (no update) when the grant is already inactive', async () => {
    const prisma = mockPrisma({
      recordGrant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'g1',
          status: 'REVOKED',
          granteeType: 'USER',
          granteeId: 'u1',
        }),
        update: jest.fn(),
      },
    });
    const perms = mockPermissions();
    const svc = new RecordGrantsService(prisma, perms, mockAudit());

    await svc.revoke('g1');
    expect(prisma.recordGrant.update).not.toHaveBeenCalled();
    expect(perms.bust).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown grant', async () => {
    const svc = new RecordGrantsService(mockPrisma(), mockPermissions(), mockAudit());
    await expect(svc.revoke('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RecordGrantsService.expireOverdue', () => {
  it('expires past-due grants and personas, busting all caches', async () => {
    const prisma = mockPrisma({
      recordGrant: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      userPersona: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    });
    const perms = mockPermissions();
    const svc = new RecordGrantsService(prisma, perms, mockAudit());

    const res = await svc.expireOverdue(new Date('2026-06-10T00:00:00Z'));

    expect(res).toEqual({ expiredGrants: 2, expiredPersonas: 1 });
    expect(perms.bustAll).toHaveBeenCalled();
  });
});

describe('RecordGrantsService.whoCanAccess', () => {
  it('reports OWNER, PERSONA_SCOPE and GRANT principals', async () => {
    const prisma = mockPrisma({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'owner1', email: 'o@x.com', name: 'Owner One' }) // owner
          .mockResolvedValueOnce({ email: 'g@x.com', name: 'Grantee' }), // grant user label
      },
      persona: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'admin-id',
            slug: 'admin',
            name: 'Admin',
            permissions: [{ actions: ['read', 'update'] }],
          },
        ]),
      },
      recordGrant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'g1',
            granteeType: 'USER',
            granteeId: 'gu1',
            actions: ['read'],
            reason: 'audit',
            expiresAt: null,
          },
        ]),
      },
    });
    const perms = mockPermissions({
      resolveRecord: jest
        .fn()
        .mockResolvedValue({ id: 'p1', ownerId: 'owner1', participantIds: [] }),
    });
    const svc = new RecordGrantsService(prisma, perms, mockAudit());

    const report = await svc.whoCanAccess('project', 'p1');

    const sources = report.map((r) => r.source);
    expect(sources).toContain('OWNER');
    expect(sources).toContain('PERSONA_SCOPE');
    expect(sources).toContain('GRANT');

    const owner = report.find((r) => r.source === 'OWNER');
    expect(owner?.principalId).toBe('owner1');

    const grant = report.find((r) => r.source === 'GRANT');
    expect(grant?.actions).toEqual(['read']);
    expect(grant?.detail).toMatchObject({ grantId: 'g1', reason: 'audit' });
  });
});
