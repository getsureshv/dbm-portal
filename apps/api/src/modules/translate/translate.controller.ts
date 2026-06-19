import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TranslateService } from './translate.service';
import { TranslateDto } from './dto/translate.dto';

@ApiTags('translate')
@UseGuards(AuthGuard)
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  // TEMPORARY DIAGNOSTIC endpoint — remove once the production translate issue
  // is resolved. Guarded by AuthGuard like the rest of the API. Returns only
  // booleans, key length, model name, and the REAL underlying error from a
  // tiny live translation. Never returns the API key value itself.
  @Get('health')
  async health() {
    return this.translateService.diagnostics();
  }

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
