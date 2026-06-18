import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// A chat message in a project's team conversation. Author and timestamp are
// captured server-side from the authenticated user.
export class CreateMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
