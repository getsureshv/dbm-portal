import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UpdateProviderProfileDto } from './providers.dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        professionalProfile: {
          include: { tradeCategory: true, tradeName: true },
        },
        supplierProfile: {
          include: { tradeCategory: true, tradeName: true },
        },
        freightProfile: {
          include: { tradeCategory: true, tradeName: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For OWNER users, return basic profile from User model
    if (user.role === 'OWNER') {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        providerType: null,
        name: user.name,
        phone: user.phone,
        profile: null,
      };
    }

    if (user.role !== 'PROVIDER') {
      throw new BadRequestException('User is not a provider or owner');
    }

    let profile: Record<string, unknown> | null = null;

    if (user.providerType === 'PROFESSIONAL' && user.professionalProfile) {
      const p = user.professionalProfile;
      profile = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.companyName,
        phone: p.contactNumber1,
        phone2: p.contactNumber2,
        email: p.email,
        website: p.website,
        address: p.address,
        yearsInBusiness: p.yearsInBusiness,
        yearsInProfession: p.yearsInProfession,
        licenseNumber: p.licenseNumber,
        licenseStatus: p.licenseStatus,
        styleOfWork: p.styleOfWork,
        awards: p.awards,
        tradeCategory: p.tradeCategory
          ? { id: p.tradeCategory.id, label: p.tradeCategory.label }
          : null,
        tradeName: p.tradeName
          ? { id: p.tradeName.id, name: p.tradeName.name, slug: p.tradeName.slug }
          : null,
      };
    } else if (user.providerType === 'SUPPLIER' && user.supplierProfile) {
      const p = user.supplierProfile;
      profile = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.companyName,
        phone: p.contactNumber1,
        phone2: p.contactNumber2,
        email: p.email,
        website: p.website,
        address: p.address,
        materialTypes: p.materialTypes,
        servicesProvided: p.servicesProvided,
        licenseStatus: p.licenseStatus,
        tradeCategory: p.tradeCategory
          ? { id: p.tradeCategory.id, label: p.tradeCategory.label }
          : null,
        tradeName: p.tradeName
          ? { id: p.tradeName.id, name: p.tradeName.name, slug: p.tradeName.slug }
          : null,
      };
    } else if (user.providerType === 'FREIGHT' && user.freightProfile) {
      const p = user.freightProfile;
      profile = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.companyName,
        phone: p.contactNumber1,
        phone2: p.contactNumber2,
        email: p.email,
        website: p.website,
        address: p.address,
        serviceTypes: p.serviceTypes,
        servicesProvided: p.servicesProvided,
        licenseStatus: p.licenseStatus,
        tradeCategory: p.tradeCategory
          ? { id: p.tradeCategory.id, label: p.tradeCategory.label }
          : null,
        tradeName: p.tradeName
          ? { id: p.tradeName.id, name: p.tradeName.name, slug: p.tradeName.slug }
          : null,
      };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      providerType: user.providerType,
      name: user.name,
      phone: user.phone,
      profile,
    };
  }

  async updateProfile(userId: string, dto: UpdateProviderProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Handle OWNER profile update
    if (user.role === 'OWNER') {
      const updateData: Record<string, unknown> = {};
      if (dto.firstName !== undefined || dto.lastName !== undefined) {
        // Build name from firstName + lastName for owners
        const name = [dto.firstName, dto.lastName].filter(Boolean).join(' ');
        if (name) updateData.name = name;
      }
      if (dto.phone !== undefined) updateData.phone = dto.phone;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: updateData,
        });
      }

      return this.getMyProfile(userId);
    }

    if (user.role !== 'PROVIDER') {
      throw new BadRequestException('User is not a provider or owner');
    }

    // Build common update fields
    const commonFields: Record<string, unknown> = {};
    if (dto.firstName !== undefined) commonFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) commonFields.lastName = dto.lastName;
    if (dto.companyName !== undefined) commonFields.companyName = dto.companyName;
    if (dto.phone !== undefined) commonFields.contactNumber1 = dto.phone;
    if (dto.email !== undefined) commonFields.email = dto.email;
    if (dto.website !== undefined) commonFields.website = dto.website;
    if (dto.address !== undefined) commonFields.address = dto.address;

    if (user.providerType === 'PROFESSIONAL') {
      const profFields: Record<string, unknown> = { ...commonFields };
      if (dto.yearsInBusiness !== undefined)
        profFields.yearsInBusiness = dto.yearsInBusiness;
      if (dto.licenseNumber !== undefined)
        profFields.licenseNumber = dto.licenseNumber;
      if (dto.trades !== undefined) profFields.styleOfWork = dto.trades;

      await this.prisma.professionalProfile.update({
        where: { userId },
        data: profFields,
      });
    } else if (user.providerType === 'SUPPLIER') {
      const suppFields: Record<string, unknown> = { ...commonFields };
      if (dto.trades !== undefined) suppFields.materialTypes = dto.trades;

      await this.prisma.supplierProfile.update({
        where: { userId },
        data: suppFields,
      });
    } else if (user.providerType === 'FREIGHT') {
      const freightFields: Record<string, unknown> = { ...commonFields };
      if (dto.trades !== undefined) freightFields.serviceTypes = dto.trades;

      await this.prisma.freightProfile.update({
        where: { userId },
        data: freightFields,
      });
    } else {
      throw new BadRequestException('Unknown provider type');
    }

    return this.getMyProfile(userId);
  }
}
