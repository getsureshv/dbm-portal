import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class TranslateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  text: string;

  // Accept either `targetLang` or `targetLanguage` from the client.
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(({ value, obj }) => value ?? obj?.targetLanguage)
  targetLang: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceLang?: string;
}
