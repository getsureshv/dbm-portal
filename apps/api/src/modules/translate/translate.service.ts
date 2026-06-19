import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../common/prisma.service';

export interface TranslateResult {
  translatedText: string;
  detectedSourceLang?: string;
  cached: boolean;
}

@Injectable()
export class TranslateService {
  private anthropic: Anthropic | null = null;
  // Same model family the AI participant uses, kept in sync deliberately.
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn(
        'ANTHROPIC_API_KEY not configured — translation features will be unavailable',
      );
    }
  }

  private hash(text: string): string {
    // Normalize whitespace so trivially different inputs share a cache entry.
    const normalized = text.trim().replace(/\s+/g, ' ');
    return createHash('sha256').update(normalized).digest('hex');
  }

  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<TranslateResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { translatedText: text, cached: false };
    }

    const textHash = this.hash(trimmed);

    // 1) Cache lookup.
    const hit = await this.prisma.translationCache.findUnique({
      where: { textHash_targetLang: { textHash, targetLang } },
    });
    if (hit) {
      return { translatedText: hit.translatedText, cached: true };
    }

    // 2) No Anthropic client → graceful 503 so the UI can show a notice.
    if (!this.anthropic) {
      throw new ServiceUnavailableException(
        'Translation is not configured. Set ANTHROPIC_API_KEY to enable it.',
      );
    }

    const system =
      'You are a precise translation engine. Translate the user-provided text into the requested target language. ' +
      'Return ONLY the translated text with no preamble, quotes, notes, or explanation. ' +
      'Preserve meaning, tone, names, numbers, URLs, and emoji. ' +
      'If the text is already in the target language, return it unchanged.';

    const userContent = sourceLang
      ? `Target language: ${targetLang}\nSource language: ${sourceLang}\n\nText:\n${trimmed}`
      : `Target language: ${targetLang}\n\nText:\n${trimmed}`;

    let translatedText: string;
    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: userContent }],
        stream: false,
      });
      const block = response.content.find((b) => b.type === 'text');
      translatedText =
        block && block.type === 'text' ? block.text.trim() : '';
    } catch (err: any) {
      console.error('Translation error:', err?.message ?? err);
      throw new ServiceUnavailableException(
        'Translation service is temporarily unavailable. Please try again.',
      );
    }

    if (!translatedText) {
      throw new ServiceUnavailableException(
        'Translation service returned an empty result. Please try again.',
      );
    }

    // 3) Persist to cache. Tolerate races on the unique key.
    try {
      await this.prisma.translationCache.create({
        data: { textHash, targetLang, translatedText },
      });
    } catch {
      // Another request cached the same (textHash, targetLang) concurrently.
    }

    return { translatedText, cached: false };
  }
}
