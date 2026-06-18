import { IsString, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

// Body of a direct message. Sender and timestamps are captured server-side.
export class DmMessageDto {
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
