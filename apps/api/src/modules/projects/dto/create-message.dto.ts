import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

// A chat message in a project's team conversation. Author and timestamp are
// captured server-side from the authenticated user. Body is optional when
// attachments are present (image-only messages allowed); the service rejects a
// message that has neither text nor attachments.
export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}

// Editing an existing message — body remains required.
export class EditMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
