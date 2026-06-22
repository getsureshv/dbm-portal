import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TranslateService } from './translate.service';
import { TranslateDto } from './dto/translate.dto';

@ApiTags('translate')
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  // TEMP DIAG — remove after diagnosis. Unauthenticated (no AuthGuard) so we
  // can hit it directly on prod to see the REAL Anthropic error. Returns the
  // full "Anthropic <status>: <body>" string in `error` on failure. Never
  // leaks the API key (length only).
  @Get('diag')
  async diag() {
    return this.translateService.diag();
  }

  @UseGuards(AuthGuard)
  @Post()
  async translate(@Body() dto: TranslateDto) {
    const result = await this.translateService.translate(
      dto.text,
      dto.targetLang,
      dto.sourceLang,
    );
    return {
      translatedText: result.translatedText,
      detectedSourceLang: result.detectedSourceLang,
      cached: result.cached,
    };
  }
}
