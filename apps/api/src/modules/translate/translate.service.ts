import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { callAnthropic } from '../../common/anthropic';
import { PrismaService } from '../../common/prisma.service';

export interface TranslateResult {
  translatedText: string;
  detectedSourceLang?: string;
  cached: boolean;
}

@Injectable()
export class TranslateService {
  private apiKey: string | null = null;
  // Fast, cheap model is ideal for translation. Overridable via env.
  private readonly model =
    process.env.TRANSLATE_MODEL || 'claude-haiku-4-5-20251001';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.apiKey = apiKey;
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

    // 1) Cache lookup. Non-fatal: if the translation_cache table is missing
    // (e.g. `prisma db push` has not run for this model on the deployed DB) or
    // any other DB error occurs, log and fall through to a live translation
    // rather than failing the whole request.
    try {
      const hit = await this.prisma.translationCache.findUnique({
        where: { textHash_targetLang: { textHash, targetLang } },
      });
      if (hit) {
        return { translatedText: hit.translatedText, cached: true };
      }
    } catch (err: any) {
      console.error(
        'Translation cache read failed (continuing without cache):',
        err?.message ?? err,
      );
    }

    // 2) No API key → graceful 503 so the UI can show a notice.
    if (!this.apiKey) {
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
      const { text } = await callAnthropic({
        apiKey: this.apiKey,
        model: this.model,
        maxTokens: 2048,
        system,
        messages: [{ role: 'user', content: userContent }],
      });
      translatedText = text.trim();
    } catch (err: any) {
      // Surface the REAL underlying cause to the client per the standing rule
      // "surface real errors, no silent generic unavailable". The native-fetch
      // helper throws an Error whose message carries the HTTP status + response
      // body (e.g. 401 auth, 404 unknown model, 400 bad request). We log it and
      // include it in the thrown message so failures are debuggable from the
      // client/UI. The Anthropic helper never includes the API key in its
      // message, so this does not leak the key.
      const cause = err?.message ?? String(err);
      console.error(`Translation error: message=${cause}`);
      throw new ServiceUnavailableException(`Translation failed: ${cause}`);
    }

    if (!translatedText) {
      throw new ServiceUnavailableException(
        'Translation service returned an empty result. Please try again.',
      );
    }

    // 3) Persist to cache. Non-fatal: tolerate races on the unique key AND a
    // missing table — never let a cache write failure break a successful
    // translation.
    try {
      await this.prisma.translationCache.create({
        data: { textHash, targetLang, translatedText },
      });
    } catch (err: any) {
      // Unique-constraint races are expected and benign; other errors (e.g.
      // missing table) are logged but still non-fatal.
      console.error(
        'Translation cache write failed (non-fatal):',
        err?.message ?? err,
      );
    }

    return { translatedText, cached: false };
  }
}
