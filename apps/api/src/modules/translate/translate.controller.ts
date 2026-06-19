import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TranslateService } from './translate.service';
import { TranslateDto } from './dto/translate.dto';

@ApiTags('translate')
@UseGuards(AuthGuard)
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

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
