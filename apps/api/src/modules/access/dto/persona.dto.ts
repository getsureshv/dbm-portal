import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

enum PersonaBaseType {
  CLIENT = 'CLIENT',
  PROFESSIONAL = 'PROFESSIONAL',
  SUPPLIER = 'SUPPLIER',
  FREIGHT = 'FREIGHT',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  ADMIN = 'ADMIN',
  CUSTOM = 'CUSTOM',
}

enum PermissionScope {
  ALL = 'ALL',
  OWN = 'OWN',
  ASSIGNED = 'ASSIGNED',
}

export class CreatePersonaDto {
  @IsString() @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Unique slug' })
  slug: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsEnum(PersonaBaseType)
  @ApiProperty({ enum: PersonaBaseType })
  baseType: PersonaBaseType;

  @IsOptional() @IsBoolean()
  @ApiProperty({ required: false })
  requiresApproval?: boolean;
}

export class ClonePersonaDto {
  @IsString() @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Unique slug for the clone' })
  slug: string;
}

export class UpdatePersonaDto {
  @IsOptional() @IsString()
  @ApiProperty({ required: false })
  name?: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsOptional() @IsBoolean()
  @ApiProperty({ required: false })
  requiresApproval?: boolean;
}

export class ArchivePersonaDto {
  @IsOptional() @IsBoolean()
  @ApiProperty({ required: false, description: 'Archive even with active holders (FR-9)' })
  force?: boolean;
}

export class MatrixRowDto {
  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Entity key' })
  entity: string;

  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  @ApiProperty({ type: [String] })
  actions: string[];

  @IsEnum(PermissionScope)
  @ApiProperty({ enum: PermissionScope })
  scope: PermissionScope;
}

export class ReplacePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatrixRowDto)
  @ApiProperty({ type: [MatrixRowDto] })
  permissions: MatrixRowDto[];
}

export class UpdateEntityDto {
  @IsOptional() @IsString()
  @ApiProperty({ required: false })
  label?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  @ApiProperty({ required: false, type: [String] })
  actions?: string[];

  @IsOptional() @IsBoolean()
  @ApiProperty({ required: false })
  supportsRecordGrants?: boolean;
}

export class AssignPersonaDto {
  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Persona id to assign' })
  personaId: string;

  @IsOptional() @IsString()
  @ApiProperty({ required: false, description: 'Optional ISO-8601 expiry' })
  expiresAt?: string;
}
