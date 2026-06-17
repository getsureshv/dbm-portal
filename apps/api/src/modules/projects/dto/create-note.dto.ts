import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// A free-text note/comment added to a project. The author and timestamp are
// captured server-side from the authenticated user, not the request body.
export class CreateNoteDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
