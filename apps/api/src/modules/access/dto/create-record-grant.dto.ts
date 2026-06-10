import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum GranteeType {
  USER = 'USER',
  PERSONA = 'PERSONA',
}

/**
 * Body for POST /admin/record-grants (FR-11). Grants {actions} on one record
 * (entity + recordId) to a USER or a PERSONA, with a mandatory free-text reason
 * and optional expiry.
 */
export class CreateRecordGrantDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Entity key, e.g. "project"' })
  entity: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Record id the grant applies to' })
  recordId: string;

  @IsEnum(GranteeType)
  @ApiProperty({ enum: GranteeType, description: 'USER or PERSONA' })
  granteeType: GranteeType;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'User id or persona id, per granteeType' })
  granteeId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ApiProperty({ type: [String], description: 'Actions granted, e.g. ["read","update"]' })
  actions: string[];

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Mandatory free-text reason for the grant' })
  reason: string;

  @IsOptional()
  @IsISO8601()
  @ApiProperty({ required: false, description: 'Optional ISO-8601 expiry timestamp' })
  expiresAt?: string;
}
