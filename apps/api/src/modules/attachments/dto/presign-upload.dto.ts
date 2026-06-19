import {
  IsString,
  IsInt,
  IsIn,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

// Request a pre-signed PUT URL for a new attachment. The server creates a
// pending Attachment row (no message link yet) and returns the URL + id; the
// browser then PUTs the bytes directly to R2 and includes the id when sending
// the message. Only `image` is accepted in increment 1, but the shape is kept
// generic so video/audio/file slot in later.
export class PresignUploadDto {
  // Kept generic; service rejects anything but 'image' for now.
  @IsString()
  @IsIn(['image', 'video', 'audio', 'file'])
  kind: string;

  @IsString()
  @MaxLength(255)
  mime: string;

  @IsInt()
  @Min(1)
  // Hard ceiling matches the server-side image cap (25MB). Anything larger is
  // rejected here before a presign is issued.
  @Max(25 * 1024 * 1024)
  sizeBytes: number;

  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  height?: number;
}
