import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Body of a direct message. Sender and timestamps are captured server-side.
// Body is optional when attachments are present (image-only messages allowed);
// the service rejects a message that has neither text nor attachments.
export class DmMessageDto {
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

// Used for editing an existing message — body remains required there.
export class DmEditMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}

// Start (or reuse) a 1:1 conversation with another user.
export class StartThreadDto {
  @IsUUID()
  userId: string;
}
