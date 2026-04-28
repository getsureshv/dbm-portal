import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { WebSearchService } from './web-search.service';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly webSearchService: WebSearchService,
  ) {}

  @Get('trades')
  @ApiOperation({ summary: 'List all trade categories and trade names' })
  async listTrades() {
    return this.discoveryService.listTrades();
  }

  @Get('web-vendors')
  @ApiOperation({
    summary:
      'Search external web sources (Yelp etc.) for providers near a ZIP code',
  })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'zip', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchWebVendors(
    @Query('query') query?: string,
    @Query('zip') zip?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    if (!zip) {
      return {
        vendors: [],
        provider: null,
        configured: false,
        message: 'A ZIP code is required for web search.',
      };
    }
    const pageLimit = Math.min(limit ? Math.max(1, limit) : 10, 25);
    return this.webSearchService.search({
      query,
      zip,
      category,
      limit: pageLimit,
    });
  }

  @Get('vendors/:id')
  @ApiOperation({ summary: 'Get vendor profile detail by ID' })
  async getVendorDetail(
    @Param('id') id: string,
    @Query('type') type?: string,
  ) {
    const vendor = await this.discoveryService.getVendorDetail(id, type || 'professional');
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    return vendor;
  }

  @Get('vendors')
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
    @Query('type') type: 'professional' | 'supplier' | 'freight',
    @Query('category') category?: string,
    @Query('query') query?: string,
    @Query('zip') zip?: string,
    @Query('radiusMiles') radiusMiles?: number,
    @Query('licenseStatus') licenseStatus?: 'active' | 'expired' | 'pending',
    @Query('minYearsInBusiness') minYearsInBusiness?: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
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
      query,
      zip,
      radiusMiles: radiusMiles ? Math.max(1, radiusMiles) : undefined,
      licenseStatus,
      minYearsInBusiness: minYearsInBusiness
        ? Math.max(0, minYearsInBusiness)
        : undefined,
      cursor,
      limit: pageLimit,
    });
  }
}
