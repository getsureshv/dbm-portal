import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/auth.guard';
import { SetRoleDto } from './dto/set-role.dto';
import { CreateProfileDto } from './dto/create-profile.dto';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('role')
  @ApiOperation({ summary: 'Set user role during onboarding' })
  async setRole(@Request() req: any, @Body() setRoleDto: SetRoleDto) {
    const userId = (req as any).userId;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.onboardingService.setRole(userId, setRoleDto);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create user profile during onboarding' })
  async createProfile(
    @Request() req: any,
    @Body() createProfileDto: CreateProfileDto,
  ) {
    const userId = (req as any).userId;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.onboardingService.createProfile(userId, createProfileDto);
  }
}
