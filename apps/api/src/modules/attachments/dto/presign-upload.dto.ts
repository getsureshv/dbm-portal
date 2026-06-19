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
// generic so audio/file slot in later. Image + video are accepted today.
export class PresignUploadDto {
  // Kept generic; service enforces per-kind mime + size and rejects audio/file.
  @IsString()
  @IsIn(['image', 'video', 'audio', 'file'])
  kind: string;

  @IsString()
  @MaxLength(255)
  mime: string;

  @IsInt()
  @Min(1)
  // Hard ceiling matches the largest per-kind cap (video, 100MB). The service
  // applies the tighter per-kind limit (images 25MB) before issuing a presign.
  @Max(100 * 1024 * 1024)
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

  // Video duration in milliseconds, read client-side from the loadedmetadata
  // event. Best-effort: omitted when the browser can't report it.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60 * 60 * 1000)
  durationMs?: number;
}
