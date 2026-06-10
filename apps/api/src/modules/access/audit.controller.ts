import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { AuditService } from './audit.service';

/**
 * Admin audit log (spec §5 Admin, FR-19/FR-20).
 *   GET /admin/audit?actorId=&subjectType=&subjectId=&from=&to=&limit=&cursor=
 *
 * Read-only — there is no write/delete surface; the log is append-only and only
 * the AuditService.record() path (called transactionally by mutations) appends
 * to it. Guarded by @RequirePermission('read','audit') — only the Admin persona
 * holds audit:read in the seed.
 */
@ApiTags('Admin / Audit')
@Controller('admin/audit')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @RequirePermission('read', 'audit')
  @ApiOperation({ summary: 'Filterable authorization audit log (FR-20)' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'subjectType', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO-8601 inclusive lower bound' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO-8601 inclusive upper bound' })
  @ApiQuery({ name: 'limit', required: false, description: '1–200, default 50' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Audit row id to page after' })
  async list(
    @Query('actorId') actorId?: string,
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.audit.query({
      actorId,
      subjectType,
      subjectId,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }
}
