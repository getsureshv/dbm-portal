import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { PermissionsService } from './permissions.service';

/**
 * Per-user access endpoints (spec §5, public/user surface):
 *   GET /me/personas      — my personas + statuses (incl. PENDING approvals)
 *   GET /me/permissions   — my effective permissions (debug/account page)
 *
 * Auth-guarded (must be logged in) but NOT permission-guarded — every user may
 * read their own access. No record is involved.
 */
@ApiTags('Me / Access')
@Controller('me')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  @Get('personas')
  @ApiOperation({ summary: 'My personas and their statuses' })
  async myPersonas(@Req() req: any) {
    const userId = req.userId;
    const rows = await this.prisma.userPersona.findMany({
      where: { userId },
      include: {
        persona: {
          select: { id: true, slug: true, name: true, baseType: true, requiresApproval: true },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
    return rows.map((r) => ({
      personaId: r.persona.id,
      slug: r.persona.slug,
      name: r.persona.name,
      baseType: r.persona.baseType,
      status: r.status, // PENDING | ACTIVE | REVOKED | EXPIRED
      assignedAt: r.assignedAt,
      expiresAt: r.expiresAt,
    }));
  }

  @Get('permissions')
  @ApiOperation({ summary: 'My effective permissions (active personas + grants)' })
  async myPermissions(@Req() req: any) {
    return this.permissions.effectivePermissions(req.userId);
  }
}
