import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key + decorator declaring the (action, entity) a route requires.
 * The {@link PermissionGuard} reads this and runs the central `can()` check.
 *
 *   @RequirePermission('read', 'project')      // record id taken from :id param
 *   @RequirePermission('update', 'project', 'projectId')  // custom param name
 *   @RequirePermission('create', 'project')    // create-path, no record (FR-17)
 *
 * `recordParam` names the route param holding the record id (default "id").
 * For `create` actions the param is ignored (FR-17).
 */
export const PERMISSION_KEY = 'dbm:permission';

export interface PermissionRequirement {
  action: string;
  entity: string;
  recordParam: string;
}

export const RequirePermission = (
  action: string,
  entity: string,
  recordParam = 'id',
) => SetMetadata<string, PermissionRequirement>(PERMISSION_KEY, { action, entity, recordParam });
