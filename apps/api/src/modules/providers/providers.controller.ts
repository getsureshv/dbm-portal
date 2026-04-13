import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateProviderProfileDto } from './providers.dto';

@ApiTags('Providers')
@Controller('providers')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current provider profile' })
  async getMyProfile(@Request() req: any) {
    const userId = req.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.providersService.getMyProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current provider profile' })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    const userId = req.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.providersService.updateProfile(userId, dto);
  }
}
