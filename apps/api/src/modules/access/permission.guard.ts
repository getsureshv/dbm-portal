import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import {
  PERMISSION_KEY,
  PermissionRequirement,
} from './require-permission.decorator';

/**
 * PermissionGuard (PR3) — enforces the central `can()` check on any route
 * annotated with `@RequirePermission(...)`. Must run AFTER `AuthGuard` so that
 * `req.userId` is populated (declare it second in `@UseGuards(AuthGuard,
 * PermissionGuard)`).
 *
 * Enforcement rules (FR-15.4):
 *   - read-style actions (read / list / get / view / download / export) →
 *     deny returns **404** (don't leak record existence).
 *   - all other actions (write/mutate) → deny returns **403**.
 *   - missing record → **404** regardless of action.
 *
 * Routes WITHOUT `@RequirePermission` are untouched — this guard is a no-op for
 * them, so attaching it globally or per-controller never changes the behaviour
 * of un-annotated endpoints (important: the live deploy must not regress).
 */
const READ_ACTIONS = new Set([
  'read',
  'list',
  'get',
  'view',
  'download',
  'export',
]);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    // No requirement declared → this guard does nothing.
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.userId;
    if (!userId) {
      // Should have been caught by AuthGuard, but fail safe.
      throw new UnauthorizedException('No authenticated user');
    }

    const { action, entity, recordParam } = requirement;
    const recordId =
      action === 'create' ? undefined : req.params?.[recordParam];

    const { decision, recordMissing } = await this.permissions.check(
      userId,
      action,
      entity,
      recordId,
    );

    if (decision.allowed) return true;

    // Deny. 404 for reads or missing records; 403 for writes.
    if (recordMissing || READ_ACTIONS.has(action)) {
      throw new NotFoundException();
    }
    throw new ForbiddenException();
  }
}
