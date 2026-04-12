import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SetRoleDto } from './dto/set-role.dto';
import { CreateProfileDto } from './dto/create-profile.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async setRole(userId: string, setRoleDto: SetRoleDto) {
    // Check if user already has a role set
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role) {
      throw new BadRequestException('User role is already set');
    }

    // Update user with role and providerType
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: setRoleDto.role,
        providerType: setRoleDto.providerType || null,
      },
    });

    return {
      message: 'Role set successfully',
      role: updatedUser.role,
      providerType: updatedUser.providerType,
    };
  }

  async createProfile(userId: string, createProfileDto: CreateProfileDto) {
    // Get user and their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.role) {
      throw new BadRequestException(
        'User must set role before creating profile',
      );
    }

    if (user.onboardingComplete) {
      throw new BadRequestException('User onboarding is already complete');
    }

    // Handle OWNER profile creation
    if (user.role === 'OWNER') {
      const ownerData = createProfileDto as any;

      if (!ownerData.name || !ownerData.phone) {
        throw new BadRequestException(
          'OWNER profile requires name and phone',
        );
      }

      // Update user record with name and phone (no separate profile table for OWNER)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: ownerData.name,
          phone: ownerData.phone,
        },
      });
    }

    // Handle PROVIDER profile creation
    if (user.role === 'PROVIDER') {
      const providerData = createProfileDto as any;
      const providerType = user.providerType;

      if (providerType === 'PROFESSIONAL') {
        // Validate required fields for PROFESSIONAL provider
        if (
          !providerData.firstName ||
          !providerData.lastName ||
          !providerData.companyName ||
          !providerData.contactNumber1 ||
          !providerData.email ||
          !providerData.tradeNameSlug
        ) {
          throw new BadRequestException(
            'PROFESSIONAL profile requires firstName, lastName, companyName, contactNumber1, email, and tradeNameSlug',
          );
        }

        await this.prisma.professionalProfile.upsert({
          where: { userId },
          create: {
            userId,
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            licenseStatus: providerData.licenseStatus || 'NOT_APPLICABLE',
            tradeNameId: providerData.tradeNameId || null,
          },
          update: {
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            licenseStatus: providerData.licenseStatus || 'NOT_APPLICABLE',
            tradeNameId: providerData.tradeNameId || null,
          },
        });
      } else if (providerType === 'SUPPLIER') {
        // Validate required fields for SUPPLIER provider
        if (
          !providerData.firstName ||
          !providerData.lastName ||
          !providerData.companyName ||
          !providerData.contactNumber1 ||
          !providerData.email
        ) {
          throw new BadRequestException(
            'SUPPLIER profile requires firstName, lastName, companyName, contactNumber1, and email',
          );
        }

        await this.prisma.supplierProfile.upsert({
          where: { userId },
          create: {
            userId,
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            website: providerData.website || null,
          },
          update: {
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            website: providerData.website || null,
          },
        });
      } else if (providerType === 'FREIGHT') {
        // Validate required fields for FREIGHT provider
        if (
          !providerData.firstName ||
          !providerData.lastName ||
          !providerData.companyName ||
          !providerData.contactNumber1 ||
          !providerData.email
        ) {
          throw new BadRequestException(
            'FREIGHT profile requires firstName, lastName, companyName, contactNumber1, and email',
          );
        }

        await this.prisma.freightProfile.upsert({
          where: { userId },
          create: {
            userId,
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            licenseStatus: providerData.licenseStatus || 'NOT_APPLICABLE',
          },
          update: {
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            companyName: providerData.companyName,
            contactNumber1: providerData.contactNumber1,
            contactNumber2: providerData.contactNumber2 || null,
            email: providerData.email,
            licenseStatus: providerData.licenseStatus || 'NOT_APPLICABLE',
          },
        });
      } else {
        throw new BadRequestException(
          'Invalid provider type for profile creation',
        );
      }
    }

    // Mark onboarding as complete
    const completedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingComplete: true,
      },
    });

    return {
      message: 'Profile created successfully',
      onboardingComplete: completedUser.onboardingComplete,
    };
  }
}
