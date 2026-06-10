import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { RecordGrantsService } from './record-grants.service';
import { CreateRecordGrantDto } from './dto/create-record-grant.dto';
import { RevokeRecordGrantDto } from './dto/revoke-record-grant.dto';

/**
 * Admin record-grant management (spec §5 Admin, FR-11…FR-13).
 *   POST   /admin/record-grants                  — issue a grant
 *   POST   /admin/record-grants/:id/revoke       — revoke a grant
 *   GET    /admin/record-grants?entity=&recordId= — who-can-access report
 *   POST   /admin/record-grants/expire-overdue   — run the expiry sweep (FR-18)
 *
 * All routes require the central can() check via @RequirePermission on the
 * `user_access` entity — only the Admin persona holds those actions in the seed.
 */
@ApiTags('Admin / Record grants')
@Controller('admin/record-grants')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RecordGrantsController {
  constructor(private grants: RecordGrantsService) {}

  @Post()
  @RequirePermission('grant', 'user_access')
  @ApiOperation({ summary: 'Issue a record grant (user or persona)' })
  async create(@Body() dto: CreateRecordGrantDto, @Req() req: any) {
    return this.grants.create({
      entity: dto.entity,
      recordId: dto.recordId,
      granteeType: dto.granteeType,
      granteeId: dto.granteeId,
      actions: dto.actions,
      reason: dto.reason,
      expiresAt: dto.expiresAt ?? null,
      grantedBy: req.userId,
    });
  }

  @Post(':id/revoke')
  @RequirePermission('revoke', 'user_access')
  @ApiOperation({ summary: 'Revoke a record grant' })
  async revoke(@Param('id') id: string, @Body() _dto: RevokeRecordGrantDto) {
    return this.grants.revoke(id);
  }

  @Post('expire-overdue')
  @RequirePermission('revoke', 'user_access')
  @ApiOperation({
    summary: 'Expire past-due grants & personas (FR-18 daily-job entry point)',
  })
  async expireOverdue() {
    return this.grants.expireOverdue();
  }

  @Get()
  @RequirePermission('read', 'user_access')
  @ApiOperation({ summary: 'Who-can-access report for a record (FR-13)' })
  @ApiQuery({ name: 'entity', required: true })
  @ApiQuery({ name: 'recordId', required: true })
  @ApiQuery({ name: 'view', required: false, enum: ['report', 'grants'] })
  async whoCanAccess(
    @Query('entity') entity: string,
    @Query('recordId') recordId: string,
    @Query('view') view?: string,
  ) {
    if (view === 'grants') {
      return this.grants.listForRecord(entity, recordId);
    }
    return this.grants.whoCanAccess(entity, recordId);
  }
}
