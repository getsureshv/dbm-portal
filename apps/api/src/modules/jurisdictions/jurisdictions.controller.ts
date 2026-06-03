import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JurisdictionsService } from './jurisdictions.service';

@ApiTags('Jurisdictions')
@Controller('jurisdictions')
export class JurisdictionsController {
  constructor(private readonly svc: JurisdictionsService) {}

  @Get()
  @ApiOperation({ summary: 'List jurisdictions available in the demo' })
  list() {
    return this.svc.list();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for every wired adapter' })
  health() {
    return this.svc.healthAll();
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a free-text address to a jurisdiction (demo: ZIP only)' })
  @ApiQuery({ name: 'address', required: true })
  async resolve(@Query('address') address: string) {
    if (!address) throw new BadRequestException('address required');
    const j = await this.svc.resolveAddress(address);
    return { address, jurisdiction: j };
  }

  @Get(':slug/permits')
  @ApiOperation({ summary: 'Permits-by-address for a given jurisdiction' })
  @ApiQuery({ name: 'address', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  permits(
    @Param('slug') slug: string,
    @Query('address') address: string,
    @Query('limit') limit?: string,
    @Query('force') force?: string,
  ) {
    if (!address) throw new BadRequestException('address required');
    return this.svc.permitsByAddress(slug, address, {
      limit: limit ? Number(limit) : undefined,
      force: force === 'true',
    });
  }

  @Get(':slug/code-rules')
  @ApiOperation({ summary: 'Curated code rules for a jurisdiction (optional scope filter)' })
  @ApiQuery({ name: 'scope', required: false, description: 'e.g. deck, adu, kitchen, solar' })
  codeRules(@Param('slug') slug: string, @Query('scope') scope?: string) {
    return this.svc.codeRules(slug, scope);
  }
}
