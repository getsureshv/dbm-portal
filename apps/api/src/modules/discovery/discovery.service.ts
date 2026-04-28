import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface SearchVendorsParams {
  type: 'professional' | 'supplier' | 'freight';
  category?: string;
  query?: string;
  zip?: string;
  radiusMiles?: number;
  licenseStatus?: string;
  minYearsInBusiness?: number;
  cursor?: string;
  limit: number;
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

  /**
   * List all trade categories with their trade names.
   */
  async listTrades() {
    const categories = await this.prisma.tradeCategory.findMany({
      include: {
        trades: {
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { label: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      label: cat.label,
      trades: cat.trades,
    }));
  }

  async getVendorDetail(profileId: string, type: string) {
    const includeRelations = {
      tradeName: { select: { name: true, slug: true } },
      tradeCategory: { select: { label: true } },
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    };

    let profile: any = null;

    if (type === 'professional') {
      profile = await this.prisma.professionalProfile.findUnique({
        where: { id: profileId },
        include: includeRelations,
      });
    } else if (type === 'supplier') {
      profile = await this.prisma.supplierProfile.findUnique({
        where: { id: profileId },
        include: includeRelations,
      });
    } else if (type === 'freight') {
      profile = await this.prisma.freightProfile.findUnique({
        where: { id: profileId },
        include: includeRelations,
      });
    }

    if (!profile) {
      // Try all types if not found
      profile = await this.prisma.professionalProfile.findUnique({
        where: { id: profileId },
        include: includeRelations,
      });
      if (profile) type = 'professional';

      if (!profile) {
        profile = await this.prisma.supplierProfile.findUnique({
          where: { id: profileId },
          include: includeRelations,
        });
        if (profile) type = 'supplier';
      }

      if (!profile) {
        profile = await this.prisma.freightProfile.findUnique({
          where: { id: profileId },
          include: includeRelations,
        });
        if (profile) type = 'freight';
      }
    }

    if (!profile) return null;

    return {
      id: profile.id,
      providerType: type,
      companyName: profile.companyName || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      email: profile.email || null,
      phone: profile.contactNumber1 || null,
      phone2: profile.contactNumber2 || null,
      website: profile.website || null,
      address: profile.address || null,
      yearsInBusiness: profile.yearsInBusiness ?? null,
      yearsInProfession: profile.yearsInProfession ?? null,
      licenseNumber: profile.licenseNumber || null,
      licenseStatus: profile.licenseStatus || 'NOT_APPLICABLE',
      styleOfWork: profile.styleOfWork || profile.materialTypes || profile.serviceTypes || [],
      awards: profile.awards || [],
      tradeName: profile.tradeName
        ? { name: profile.tradeName.name, slug: profile.tradeName.slug }
        : null,
      tradeCategory: profile.tradeCategory
        ? { label: profile.tradeCategory.label }
        : null,
      memberSince: profile.user?.createdAt || profile.createdAt,
    };
  }

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
      query,
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

    // Text search: match against company name, first/last name, or trade name
    if (query) {
      where.OR = [
        { companyName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { tradeName: { name: { contains: query, mode: 'insensitive' } } },
      ];
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
