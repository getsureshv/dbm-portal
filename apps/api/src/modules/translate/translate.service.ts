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
  private readonly apiKeyPresent: boolean;
  private readonly apiKeyLength: number;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.apiKeyPresent = !!apiKey;
    this.apiKeyLength = apiKey ? apiKey.length : 0;
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
      // Surface the REAL underlying error server-side for diagnosis. The
      // Anthropic SDK puts the HTTP status on `err.status` and a detailed
      // message on `err.message` (e.g. 401 auth, 404 unknown model, 400 bad
      // request). The client still receives the friendly message below.
      console.error(
        `Translation error: status=${err?.status ?? 'n/a'} name=${err?.name ?? 'n/a'} message=${err?.message ?? err}`,
      );
      throw new ServiceUnavailableException(
        'Translation service is temporarily unavailable. Please try again.',
      );
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

  // ---------------------------------------------------------------------------
  // TEMPORARY DIAGNOSTIC — remove once the production translate issue is
  // resolved. Exposed via GET /translate/health. Never returns the API key
  // value; only booleans, key length, and the real underlying error messages.
  // ---------------------------------------------------------------------------
  async diagnostics(): Promise<{
    anthropicKeyPresent: boolean;
    anthropicKeyLength: number;
    model: string;
    cacheTableOk: boolean;
    cacheError?: string;
    testTranslation:
      | { ok: true; result: string }
      | { ok: false; error: string };
  }> {
    // Probe the cache table with a trivial query.
    let cacheTableOk = false;
    let cacheError: string | undefined;
    try {
      await this.prisma.translationCache.count();
      cacheTableOk = true;
    } catch (err: any) {
      cacheError = `status=${err?.code ?? err?.status ?? 'n/a'} message=${err?.message ?? String(err)}`;
    }

    // Attempt a tiny live translation to surface the REAL Anthropic error.
    let testTranslation:
      | { ok: true; result: string }
      | { ok: false; error: string };
    if (!this.anthropic) {
      testTranslation = {
        ok: false,
        error: 'Anthropic client not initialized (ANTHROPIC_API_KEY missing).',
      };
    } else {
      try {
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 64,
          system:
            'You are a precise translation engine. Return ONLY the translated text.',
          messages: [
            {
              role: 'user',
              content: 'Target language: English\n\nText:\nhola',
            },
          ],
          stream: false,
        });
        const block = response.content.find((b) => b.type === 'text');
        const result =
          block && block.type === 'text' ? block.text.trim() : '';
        testTranslation = { ok: true, result };
      } catch (err: any) {
        testTranslation = {
          ok: false,
          error: `status=${err?.status ?? 'n/a'} name=${err?.name ?? 'n/a'} message=${err?.message ?? String(err)}`,
        };
      }
    }

    return {
      anthropicKeyPresent: this.apiKeyPresent,
      anthropicKeyLength: this.apiKeyLength,
      model: this.model,
      cacheTableOk,
      cacheError,
      testTranslation,
    };
  }
}
