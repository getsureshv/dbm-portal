import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum UserRole {
  OWNER = 'OWNER',
  PROVIDER = 'PROVIDER',
}

enum ProviderType {
  PROFESSIONAL = 'PROFESSIONAL',
  SUPPLIER = 'SUPPLIER',
  FREIGHT = 'FREIGHT',
}

export class SetRoleDto {
  @IsEnum(UserRole)
  @ApiProperty({
    enum: UserRole,
    description: 'User role: OWNER or PROVIDER',
  })
  role: UserRole;

  @IsOptional()
  @IsEnum(ProviderType)
  @ApiProperty({
    enum: ProviderType,
    description: 'Provider type (required if role is PROVIDER)',
    required: false,
  })
  providerType?: ProviderType;
}
