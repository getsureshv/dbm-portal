import { IsOptional, IsString, IsInt, IsArray, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  address?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsInBusiness?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trades?: string[];
}
