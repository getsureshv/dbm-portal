import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { AdminPersonasService } from './admin-personas.service';
import {
  CreatePersonaDto,
  ClonePersonaDto,
  UpdatePersonaDto,
  ArchivePersonaDto,
  ReplacePermissionsDto,
  UpdateEntityDto,
} from './dto/persona.dto';

/**
 * Admin persona & entity-registry management (spec §5 Admin, FR-6/FR-7/FR-9).
 *
 *   GET    /admin/personas                  — list personas (+ holder counts)
 *   POST   /admin/personas                  — create a persona
 *   GET    /admin/personas/:id              — persona detail (matrix)
 *   PATCH  /admin/personas/:id              — update metadata
 *   POST   /admin/personas/:id/clone        — clone (incl. matrix)
 *   POST   /admin/personas/:id/archive      — archive (FR-9 holder guard)
 *   PUT    /admin/personas/:id/permissions  — full-replace matrix (FR-7)
 *   GET    /admin/entities                  — entity registry
 *   PATCH  /admin/entities/:key             — update an entity
 *   GET    /admin/approvals                 — pending provider signups (§6.5)
 *
 * Every route is gated by the central can() check via @RequirePermission on the
 * `persona` entity — only the Admin persona holds those actions in the seed.
 */
@ApiTags('Admin / Personas')
@Controller('admin')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminPersonasController {
  constructor(private personas: AdminPersonasService) {}

  // ─── Personas ──────────────────────────────────────────

  @Get('personas')
  @RequirePermission('read', 'persona')
  @ApiOperation({ summary: 'List personas with holder counts and matrices' })
  async list() {
    return this.personas.list();
  }

  @Post('personas')
  @RequirePermission('create', 'persona')
  @ApiOperation({ summary: 'Create a persona' })
  async create(@Body() dto: CreatePersonaDto, @Req() req: any) {
    return this.personas.create(
      {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        baseType: dto.baseType,
        requiresApproval: dto.requiresApproval,
      },
      req.userId,
    );
  }

  @Get('personas/:id')
  @RequirePermission('read', 'persona')
  @ApiOperation({ summary: 'Persona detail (with permission matrix)' })
  async get(@Param('id') id: string) {
    return this.personas.get(id);
  }

  @Patch('personas/:id')
  @RequirePermission('update', 'persona')
  @ApiOperation({ summary: 'Update persona metadata' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonaDto,
    @Req() req: any,
  ) {
    return this.personas.update(id, dto, req.userId);
  }

  @Post('personas/:id/clone')
  @RequirePermission('create', 'persona')
  @ApiOperation({ summary: 'Clone a persona (including its matrix)' })
  async clone(
    @Param('id') id: string,
    @Body() dto: ClonePersonaDto,
    @Req() req: any,
  ) {
    return this.personas.clone(id, { name: dto.name, slug: dto.slug }, req.userId);
  }

  @Post('personas/:id/archive')
  @RequirePermission('update', 'persona')
  @ApiOperation({ summary: 'Archive a persona (FR-9 active-holder guard)' })
  async archive(
    @Param('id') id: string,
    @Body() dto: ArchivePersonaDto,
    @Req() req: any,
  ) {
    return this.personas.archive(id, { force: dto.force }, req.userId);
  }

  @Put('personas/:id/permissions')
  @RequirePermission('update', 'persona')
  @ApiOperation({ summary: 'Full-replace a persona permission matrix (FR-7)' })
  async replacePermissions(
    @Param('id') id: string,
    @Body() dto: ReplacePermissionsDto,
    @Req() req: any,
  ) {
    return this.personas.replacePermissions(
      id,
      dto.permissions.map((r) => ({
        entity: r.entity,
        actions: r.actions,
        scope: r.scope,
      })),
      req.userId,
    );
  }

  // ─── Entity registry ───────────────────────────────────

  @Get('entities')
  @RequirePermission('read', 'persona')
  @ApiOperation({ summary: 'List the entity registry' })
  async listEntities() {
    return this.personas.listEntities();
  }

  @Patch('entities/:key')
  @RequirePermission('update', 'persona')
  @ApiOperation({ summary: 'Update an entity (label / actions / record-grants)' })
  async updateEntity(
    @Param('key') key: string,
    @Body() dto: UpdateEntityDto,
    @Req() req: any,
  ) {
    return this.personas.updateEntity(key, dto, req.userId);
  }

  // ─── Approvals queue ───────────────────────────────────

  @Get('approvals')
  @RequirePermission('read', 'user_access')
  @ApiOperation({ summary: 'Pending provider signups awaiting vetting (§6.5)' })
  async pendingApprovals() {
    return this.personas.pendingApprovals();
  }
}
