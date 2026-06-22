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

  // Translate-on-send: when the client translated the outgoing text, `body`
  // holds the translation and these hold the pre-translation original.
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000)
  originalBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  originalLang?: string;
}

// Editing an existing message — body remains required.
export class EditMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
