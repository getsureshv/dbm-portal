import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface SearchVendorsParams {
  type: 'professional' | 'supplier' | 'freight';
  category?: string;
  zip?: string;
  radiusMiles?: number;
  licenseStatus?: string;
  minYearsInBusiness?: number;
  cursor?: string;
  limit: number;
  userId: string;
}

export interface VendorCard {
  id: string;
  name: string;
  providerType: 'professional' | 'supplier' | 'freight';
  trades: string[];
  yearsInBusiness: number | null;
  licenseStatus: string;
  rating: number | null;
  reviewCount: number;
  location: { zip: string } | null;
  image: string | null;
}

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async searchVendors(
    params: SearchVendorsParams,
  ): Promise<{
    vendors: VendorCard[];
    nextCursor?: string;
    total: number;
  }> {
    const {
      type,
      category,
      licenseStatus,
      minYearsInBusiness,
      cursor,
      limit,
    } = params;

    // Build where clause
    const where: any = {};

    if (licenseStatus) {
      where.licenseStatus = licenseStatus.toUpperCase();
    }

    if (minYearsInBusiness !== undefined && type === 'professional') {
      where.yearsInBusiness = { gte: minYearsInBusiness };
    }

    // Filter by trade name slug
    if (category) {
      where.tradeName = { slug: category };
    }

    // Cursor-based pagination
    const skip = cursor ? 1 : 0;
    const cursorObj = cursor ? { id: cursor } : undefined;

    const includeRelations = {
      tradeName: { select: { name: true, slug: true } },
      tradeCategory: { select: { label: true } },
    };

    let vendors: any[];
    let total: number;

    switch (type) {
      case 'professional':
        [vendors, total] = await Promise.all([
          this.prisma.professionalProfile.findMany({
            where,
            take: limit + 1,
            skip,
            cursor: cursorObj,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.professionalProfile.count({ where }),
        ]);
        break;

      case 'supplier':
        [vendors, total] = await Promise.all([
          this.prisma.supplierProfile.findMany({
            where,
            take: limit + 1,
            skip,
            cursor: cursorObj,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.supplierProfile.count({ where }),
        ]);
        break;

      case 'freight':
        [vendors, total] = await Promise.all([
          this.prisma.freightProfile.findMany({
            where,
            take: limit + 1,
            skip,
            cursor: cursorObj,
            include: includeRelations,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.freightProfile.count({ where }),
        ]);
        break;

      default:
        throw new Error(`Invalid vendor type: ${type}`);
    }

    const hasNextPage = vendors.length > limit;
    const vendorList = hasNextPage ? vendors.slice(0, limit) : vendors;
    const nextCursor = hasNextPage ? vendorList[vendorList.length - 1]?.id : undefined;

    const vendorCards: VendorCard[] = vendorList.map((vendor: any) => {
      const name =
        vendor.companyName ||
        (vendor.firstName && vendor.lastName
          ? `${vendor.firstName} ${vendor.lastName}`
          : 'Unknown');

      const trades: string[] = [];
      if (vendor.tradeName?.name) trades.push(vendor.tradeName.name);
      if (vendor.tradeCategory?.label && trades.length === 0) trades.push(vendor.tradeCategory.label);

      return {
        id: vendor.id,
        name,
        providerType: type,
        yearsInBusiness: vendor.yearsInBusiness ?? null,
        licenseStatus: vendor.licenseStatus || 'NOT_APPLICABLE',
        trades,
        rating: null,
        reviewCount: 0,
        location: null,
        image: vendor.profileImageKey || null,
      };
    });

    return { vendors: vendorCards, nextCursor, total };
  }
}
