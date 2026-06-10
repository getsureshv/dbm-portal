import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { AdminPersonasService } from './admin-personas.service';
import { PersonaAssignmentService } from './persona-assignment.service';
import { AssignPersonaDto } from './dto/persona.dto';

/**
 * Admin user-access management (spec §5 Admin, FR-3/FR-5/US-09).
 *
 *   GET    /admin/users/:userId/personas                  — a user's assignments
 *   POST   /admin/users/:userId/personas                  — assign a persona
 *   DELETE /admin/users/:userId/personas/:personaId       — revoke an assignment
 *   POST   /admin/users/:userId/personas/:personaId/approve — approve a PENDING
 *   GET    /admin/users/:userId/effective-permissions     — debug effective set
 *
 * All routes are gated by the central can() check on the `user_access` entity.
 * The recordParam is left at the default ("id") which intentionally does NOT
 * match the route params here, so the guard runs an entity-level check — only
 * the Admin persona holds `user_access` actions (ALL scope) in the seed.
 */
@ApiTags('Admin / User access')
@Controller('admin/users')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private personas: AdminPersonasService,
    private assignment: PersonaAssignmentService,
  ) {}

  @Get(':userId/personas')
  @RequirePermission('read', 'user_access')
  @ApiOperation({ summary: "A user's persona assignments" })
  async userPersonas(@Param('userId') userId: string) {
    return this.personas.userPersonas(userId);
  }

  @Post(':userId/personas')
  @RequirePermission('assign', 'user_access')
  @ApiOperation({ summary: 'Assign a persona to a user (optional expiry)' })
  async assign(
    @Param('userId') userId: string,
    @Body() dto: AssignPersonaDto,
    @Req() req: any,
  ) {
    return this.assignment.adminAssign(
      userId,
      dto.personaId,
      { expiresAt: dto.expiresAt ?? null },
      req.userId,
    );
  }

  @Delete(':userId/personas/:personaId')
  @RequirePermission('revoke', 'user_access')
  @ApiOperation({ summary: 'Revoke a user persona assignment' })
  async revoke(
    @Param('userId') userId: string,
    @Param('personaId') personaId: string,
    @Req() req: any,
  ) {
    return this.assignment.revoke(userId, personaId, req.userId);
  }

  @Post(':userId/personas/:personaId/approve')
  @RequirePermission('approve', 'user_access')
  @ApiOperation({ summary: 'Approve a PENDING persona assignment (FR-5)' })
  async approve(
    @Param('userId') userId: string,
    @Param('personaId') personaId: string,
    @Req() req: any,
  ) {
    await this.assignment.approve(userId, personaId, req.userId);
    return { userId, personaId, status: 'ACTIVE' };
  }

  @Get(':userId/effective-permissions')
  @RequirePermission('read', 'user_access')
  @ApiOperation({ summary: "A user's effective permissions (debug view)" })
  async effectivePermissions(@Param('userId') userId: string) {
    return this.personas.userEffectivePermissions(userId);
  }
}
