import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('vendors')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Search vendors by type, category, location, and filters',
  })
  @ApiQuery({
    name: 'type',
    enum: ['professional', 'supplier', 'freight'],
    description: 'Provider type',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Trade slug for filtering',
  })
  @ApiQuery({
    name: 'zip',
    required: false,
    description: 'Zip code for location-based search',
  })
  @ApiQuery({
    name: 'radiusMiles',
    required: false,
    type: Number,
    description: 'Radius in miles for proximity search',
  })
  @ApiQuery({
    name: 'licenseStatus',
    required: false,
    enum: ['active', 'expired', 'pending'],
    description: 'Filter by license status',
  })
  @ApiQuery({
    name: 'minYearsInBusiness',
    required: false,
    type: Number,
    description: 'Minimum years in business',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page limit (default: 20, max: 100)',
  })
  async searchVendors(
    @Req() req: any,
    @Query('type') type: 'professional' | 'supplier' | 'freight',
    @Query('category') category?: string,
    @Query('zip') zip?: string,
    @Query('radiusMiles') radiusMiles?: number,
    @Query('licenseStatus') licenseStatus?: 'active' | 'expired' | 'pending',
    @Query('minYearsInBusiness') minYearsInBusiness?: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    const userId = (req as any).userId;
    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (!type) {
      throw new HttpException(
        'type query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const validTypes = ['professional', 'supplier', 'freight'];
    if (!validTypes.includes(type)) {
      throw new HttpException(
        `type must be one of: ${validTypes.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const pageLimit = Math.min(limit ? Math.max(1, limit) : 20, 100);

    return this.discoveryService.searchVendors({
      type,
      category,
      zip,
      radiusMiles: radiusMiles ? Math.max(1, radiusMiles) : undefined,
      licenseStatus,
      minYearsInBusiness: minYearsInBusiness
        ? Math.max(0, minYearsInBusiness)
        : undefined,
      cursor,
      limit: pageLimit,
      userId,
    });
  }
}
