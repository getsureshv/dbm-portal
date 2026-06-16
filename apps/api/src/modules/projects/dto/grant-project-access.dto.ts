import {
  IsArray,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /projects/:id/grants — an OWNER sharing one of their own
 * projects with another user, identified by email.
 *
 * Owners may grant only "read" and/or "update" (the service clamps to this set
 * regardless); delete and grant/revoke are never delegatable here. If the email
 * is not yet a registered user, a pending invite placeholder is created and the
 * account is linked on the invitee's first sign-in.
 */
export class GrantProjectAccessDto {
  @IsEmail()
  @ApiProperty({ description: 'Email of the user to grant access to' })
  email: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['read', 'update'], { each: true })
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Actions to grant — "read" and/or "update". Defaults to both.',
  })
  actions?: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Optional reason for the audit log' })
  reason?: string;

  @IsOptional()
  @IsISO8601()
  @ApiProperty({ required: false, description: 'Optional ISO-8601 expiry timestamp' })
  expiresAt?: string;
}
