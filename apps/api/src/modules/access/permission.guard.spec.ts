import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionsService } from './permissions.service';
import { PermissionRequirement } from './require-permission.decorator';

/**
 * AC-9 integration test (guard layer): "all non-public endpoints route through
 * the central can() check — verified by a test that hits each endpoint
 * anonymously and as an under-privileged persona."
 *
 * We drive the real PermissionGuard with a real Reflector and a stubbed
 * PermissionsService.check so we exercise the actual 404-on-read / 403-on-write
 * branching (FR-15.4) without a live DB. The engine itself is covered
 * separately in permission-engine.spec.ts.
 */

function makeContext(
  requirement: PermissionRequirement | undefined,
  req: any,
): { ctx: ExecutionContext; reflector: Reflector } {
  const handler = () => undefined;
  const cls = class Dummy {};
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(requirement as any);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
  return { ctx, reflector };
}

function guardWith(
  requirement: PermissionRequirement | undefined,
  req: any,
  checkImpl: PermissionsService['check'],
) {
  const { ctx, reflector } = makeContext(requirement, req);
  const permissions = { check: checkImpl } as unknown as PermissionsService;
  const guard = new PermissionGuard(reflector, permissions);
  return { guard, ctx };
}

const REQ_READ: PermissionRequirement = {
  action: 'read',
  entity: 'project',
  recordParam: 'id',
};
const REQ_UPDATE: PermissionRequirement = {
  action: 'update',
  entity: 'project',
  recordParam: 'id',
};
const REQ_CREATE: PermissionRequirement = {
  action: 'create',
  entity: 'project',
  recordParam: 'id',
};

describe('PermissionGuard (AC-9)', () => {
  it('passes through routes with no @RequirePermission (does not regress un-annotated endpoints)', async () => {
    const { guard, ctx } = guardWith(undefined, { userId: 'u1', params: {} }, async () => {
      throw new Error('check should not be called');
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('blocks anonymous requests (no userId) with 401', async () => {
    const { guard, ctx } = guardWith(REQ_READ, { params: { id: 'p1' } }, async () => ({
      decision: { allowed: true, reason: 'persona-scope-all' },
      recordMissing: false,
    }));
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('under-privileged READ on existing record → 404 (no existence leak)', async () => {
    const { guard, ctx } = guardWith(
      REQ_READ,
      { userId: 'supplier-1', params: { id: 'p1' } },
      async () => ({
        decision: { allowed: false, reason: 'scope-not-satisfied' },
        recordMissing: false,
      }),
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('READ on a missing record → 404', async () => {
    const { guard, ctx } = guardWith(
      REQ_READ,
      { userId: 'u1', params: { id: 'ghost' } },
      async () => ({
        decision: { allowed: false, reason: 'no-matching-permission' },
        recordMissing: true,
      }),
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('under-privileged WRITE → 403', async () => {
    const { guard, ctx } = guardWith(
      REQ_UPDATE,
      { userId: 'supplier-1', params: { id: 'p1' } },
      async () => ({
        decision: { allowed: false, reason: 'scope-not-satisfied' },
        recordMissing: false,
      }),
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WRITE on a missing record → 404 even though it is a write', async () => {
    const { guard, ctx } = guardWith(
      REQ_UPDATE,
      { userId: 'u1', params: { id: 'ghost' } },
      async () => ({
        decision: { allowed: false, reason: 'no-matching-permission' },
        recordMissing: true,
      }),
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('authorized owner READ → allowed', async () => {
    const { guard, ctx } = guardWith(
      REQ_READ,
      { userId: 'owner-1', params: { id: 'p1' } },
      async () => ({
        decision: { allowed: true, reason: 'persona-scope-own', via: 'client' },
        recordMissing: false,
      }),
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('create action ignores record param and is allowed when persona permits', async () => {
    let sawRecordId: string | undefined = 'sentinel';
    const { guard, ctx } = guardWith(
      REQ_CREATE,
      { userId: 'owner-1', params: { id: 'should-be-ignored' } },
      async (_u, _a, _e, recordId) => {
        sawRecordId = recordId;
        return {
          decision: { allowed: true, reason: 'create-action', via: 'client' },
          recordMissing: false,
        };
      },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(sawRecordId).toBeUndefined(); // FR-17: create passes no recordId
  });
});
