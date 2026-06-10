import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsService } from './permissions.service';
import { PermissionGuard } from './permission.guard';
import { PersonaAssignmentService } from './persona-assignment.service';
import { MeController } from './me.controller';

/**
 * Access module (PR3). Global so any controller can inject PermissionsService
 * and use PermissionGuard / @RequirePermission without importing it everywhere.
 *
 * Exports the service + guard. The pure engine and helpers are imported
 * directly where needed (they are plain functions, not providers).
 */
@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MeController],
  providers: [PermissionsService, PermissionGuard, PersonaAssignmentService],
  exports: [PermissionsService, PermissionGuard, PersonaAssignmentService],
})
export class AccessModule {}
