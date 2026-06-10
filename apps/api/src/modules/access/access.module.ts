import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { PermissionsService } from './permissions.service';
import { PermissionGuard } from './permission.guard';

/**
 * Access module (PR3). Global so any controller can inject PermissionsService
 * and use PermissionGuard / @RequirePermission without importing it everywhere.
 *
 * Exports the service + guard. The pure engine and helpers are imported
 * directly where needed (they are plain functions, not providers).
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
})
export class AccessModule {}
