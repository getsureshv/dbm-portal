import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /admin/record-grants/:id/revoke (FR-12). Optional reason is
 * captured for the audit trail in PR6.
 */
export class RevokeRecordGrantDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Optional reason for revocation' })
  reason?: string;
}
