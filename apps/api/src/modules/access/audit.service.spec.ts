import { AuditService } from './audit.service';

/**
 * Unit tests for AuditService (PR6, FR-19/FR-20):
 *  - record() appends one row; uses tx client when provided, else base client
 *  - query() applies actor / subjectType / subjectId / date filters and
 *    cursor-paginates (fetch take+1, return take, expose nextCursor)
 *
 * Prisma is mocked.
 */

function mockPrisma(overrides: any = {}) {
  return {
    permissionAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

describe('AuditService.record', () => {
  it('appends a row using the provided tx client', async () => {
    const prisma = mockPrisma();
    const tx = mockPrisma();
    const svc = new AuditService(prisma);

    await svc.record(
      {
        actorId: 'admin1',
        action: 'record_grant.created',
        subjectType: 'record_grant',
        subjectId: 'g1',
        before: null,
        after: { id: 'g1' },
      },
      tx,
    );

    expect(tx.permissionAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.permissionAuditLog.create).not.toHaveBeenCalled();
    const arg = tx.permissionAuditLog.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      actorId: 'admin1',
      action: 'record_grant.created',
      subjectType: 'record_grant',
      subjectId: 'g1',
    });
  });

  it('falls back to the base client when no tx is given', async () => {
    const prisma = mockPrisma();
    const svc = new AuditService(prisma);
    await svc.record({ action: 'persona.updated', subjectType: 'persona' });
    expect(prisma.permissionAuditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('AuditService.query', () => {
  it('builds a where clause from all filters', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = mockPrisma({ permissionAuditLog: { findMany } });
    const svc = new AuditService(prisma);

    await svc.query({
      actorId: 'admin1',
      subjectType: 'record_grant',
      subjectId: 'g1',
      from: '2026-06-01T00:00:00Z',
      to: '2026-06-10T00:00:00Z',
      limit: 25,
    });

    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      actorId: 'admin1',
      subjectType: 'record_grant',
      subjectId: 'g1',
    });
    expect(arg.where.at.gte).toBeInstanceOf(Date);
    expect(arg.where.at.lte).toBeInstanceOf(Date);
    expect(arg.orderBy).toEqual({ at: 'desc' });
    expect(arg.take).toBe(26); // limit + 1
  });

  it('exposes nextCursor when there are more rows', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ id: `r${i}` }));
    const prisma = mockPrisma({
      permissionAuditLog: { findMany: jest.fn().mockResolvedValue(rows) },
    });
    const svc = new AuditService(prisma);

    const res = await svc.query({}); // default limit 50

    expect(res.items).toHaveLength(50);
    expect(res.nextCursor).toBe('r49');
  });

  it('returns null nextCursor when no more rows', async () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }];
    const prisma = mockPrisma({
      permissionAuditLog: { findMany: jest.fn().mockResolvedValue(rows) },
    });
    const svc = new AuditService(prisma);

    const res = await svc.query({ limit: 50 });
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBeNull();
  });

  it('clamps limit to the 1–200 range', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = mockPrisma({ permissionAuditLog: { findMany } });
    const svc = new AuditService(prisma);

    await svc.query({ limit: 9999 });
    expect(findMany.mock.calls[0][0].take).toBe(201); // 200 + 1
  });
});
