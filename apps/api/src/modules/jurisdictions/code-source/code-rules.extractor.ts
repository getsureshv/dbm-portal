/**
 * Dynamic code-rule extractor — fetches a city's published municipal code and
 * extracts structured, scope-relevant rules at query time. No pre-seeding.
 *
 * Pipeline:
 *   1. fetchSourceText(url)        — HTTP GET + strip HTML → plain text (pure-ish)
 *   2. buildExtractionPrompt(...)  — pure, returns the LLM instruction
 *   3. parseExtractedRules(json)   — pure, validates LLM JSON → ExtractedRule[]
 *   4. extractRules(...)           — orchestrates 1-3 with the Anthropic SDK
 *
 * The Anthropic dependency is injected, so when ANTHROPIC_API_KEY is absent the
 * caller passes null and extraction is a graceful no-op (returns []), matching
 * the existing chat.service degradation pattern.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { CodeSourceDoc } from './code-source.resolver';

export type CodeFamilyLike =
  | 'IBC'
  | 'IRC'
  | 'IECC'
  | 'IPC'
  | 'IMC'
  | 'NEC'
  | 'LOCAL';

export interface ExtractedRule {
  codeFamily: CodeFamilyLike;
  section: string;
  title: string;
  body: string;
  scopeTags: string[];
  sourceUrl: string;
}

const VALID_FAMILIES: ReadonlySet<string> = new Set([
  'IBC',
  'IRC',
  'IECC',
  'IPC',
  'IMC',
  'NEC',
  'LOCAL',
]);

/**
 * Strip HTML to readable text. Deliberately dependency-free (no jsdom/cheerio):
 * removes script/style, converts block tags to newlines, drops remaining tags,
 * decodes a few common entities, and collapses whitespace. Good enough to feed
 * an LLM; we are not rendering this.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract text from a PDF buffer using pdf-parse v2 (pure JS — safe on Render,
 * no native binaries). v2 exposes a `PDFParse` class (NOT a default callable):
 * `new PDFParse({ data }).getText()` → `{ text }`. Imported lazily so the module
 * loads even if the dep is absent in some envs, and always destroyed to free
 * the underlying pdf.js worker. Returns '' on any failure.
 */
async function pdfBufferToText(buf: Buffer): Promise<string> {
  let parser: { getText(): Promise<{ text: string }>; destroy(): Promise<void> } | null =
    null;
  try {
    const mod = (await import('pdf-parse')) as unknown as {
      PDFParse: new (opts: { data: Uint8Array }) => {
        getText(): Promise<{ text: string }>;
        destroy(): Promise<void>;
      };
    };
    parser = new mod.PDFParse({ data: new Uint8Array(buf) });
    const out = await parser.getText();
    return out.text ?? '';
  } catch {
    return '';
  } finally {
    try {
      await parser?.destroy();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fetch a single source doc and return trimmed plain text. Handles both HTML
 * (strip tags) and PDF (pdf-parse). Returns '' on any failure. `kind` defaults
 * to inferring from the response content-type / URL.
 */
export async function fetchSourceText(
  url: string,
  fetchImpl: typeof fetch = fetch,
  maxChars = 60000,
  timeoutMs = 15000,
  kind?: 'html' | 'pdf',
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; dbm-portal-code-extractor/1.0)',
      },
    });
    if (!res.ok) return '';
    const ctype = res.headers?.get?.('content-type') ?? '';
    const isPdf = kind === 'pdf' || /pdf/i.test(ctype) || /\.pdf(\?|$)/i.test(url);
    if (isPdf) {
      const ab = await res.arrayBuffer();
      const text = await pdfBufferToText(Buffer.from(ab));
      return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxChars);
    }
    const html = await res.text();
    return htmlToText(html).slice(0, maxChars);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch several docs and concatenate their text with labelled separators so
 * the LLM can attribute each rule to the right source. Caps total size.
 */
export async function fetchDocsText(
  docs: CodeSourceDoc[],
  fetchImpl: typeof fetch = fetch,
  totalMaxChars = 80000,
): Promise<Array<{ url: string; label: string; text: string }>> {
  const out: Array<{ url: string; label: string; text: string }> = [];
  let budget = totalMaxChars;
  for (const d of docs) {
    if (budget <= 0) break;
    const text = await fetchSourceText(
      d.url,
      fetchImpl,
      Math.min(60000, budget),
      15000,
      d.kind,
    );
    if (text && text.length >= 200) {
      out.push({ url: d.url, label: d.label, text });
      budget -= text.length;
    }
  }
  return out;
}

/** Pure: build the extraction instruction for a given scope + source text. */
export function buildExtractionPrompt(
  cityName: string,
  scope: string | undefined,
  sourceUrl: string,
  sourceText: string,
): string {
  const scopeLine = scope
    ? `Focus ONLY on rules relevant to this project scope: "${scope}" (e.g. dimensional limits, permits required, setbacks, electrical/plumbing/mechanical requirements that apply to ${scope} work).`
    : 'Extract the most commonly-needed residential building rules (permits, setbacks, height limits, egress, electrical, plumbing).';

  return [
    `You are a building-code analyst. Below is text from ${cityName}'s published municipal code (source: ${sourceUrl}).`,
    scopeLine,
    '',
    'Extract concrete, actionable code rules. Return ONLY a JSON array (no prose, no markdown fences). Each element MUST be:',
    '{',
    '  "codeFamily": one of IBC|IRC|IECC|IPC|IMC|NEC|LOCAL  (use LOCAL for city-specific amendments/ordinances),',
    '  "section": the section/ordinance number as published (e.g. "R507.2", "Sec. 9.5-3"),',
    '  "title": short human title,',
    '  "body": 1-3 sentence plain-language summary of the requirement,',
    `  "scopeTags": array of applicable scope keywords (include "${scope ?? 'general'}" when relevant)`,
    '}',
    'Rules:',
    '- Only include rules actually supported by the source text. Do NOT invent section numbers.',
    '- If the text contains no applicable rules, return [].',
    '- Max 12 rules, most important first.',
    '',
    '--- SOURCE TEXT START ---',
    sourceText,
    '--- SOURCE TEXT END ---',
  ].join('\n');
}

/** Pure: parse + validate the LLM's JSON response into ExtractedRule[]. */
export function parseExtractedRules(
  raw: string,
  sourceUrl: string,
  fallbackScope?: string,
): ExtractedRule[] {
  if (!raw) return [];
  // Tolerate accidental markdown fences or leading prose: grab the first [...] block.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: ExtractedRule[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const family = String(r.codeFamily ?? '').toUpperCase();
    const section = typeof r.section === 'string' ? r.section.trim() : '';
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    const body = typeof r.body === 'string' ? r.body.trim() : '';
    if (!section || !title || !body) continue;
    const codeFamily = (
      VALID_FAMILIES.has(family) ? family : 'LOCAL'
    ) as CodeFamilyLike;
    let scopeTags: string[] = Array.isArray(r.scopeTags)
      ? r.scopeTags.filter((t): t is string => typeof t === 'string')
      : [];
    if (scopeTags.length === 0 && fallbackScope) scopeTags = [fallbackScope];
    out.push({ codeFamily, section, title, body, scopeTags, sourceUrl });
  }
  // De-dupe by section (the upsert key) — keep first occurrence.
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = `${r.codeFamily}|${r.section}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Run one LLM extraction over a single source's text. Never throws → []. */
async function extractFromText(
  anthropic: Anthropic,
  cityName: string,
  scope: string | undefined,
  sourceUrl: string,
  sourceText: string,
  model: string,
): Promise<ExtractedRule[]> {
  const prompt = buildExtractionPrompt(cityName, scope, sourceUrl, sourceText);
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return parseExtractedRules(text, sourceUrl, scope);
  } catch {
    return [];
  }
}

/**
 * Orchestrate fetch → prompt → LLM → parse. Returns [] on any failure or when
 * the Anthropic client is null (key not configured) — never throws.
 *
 * Accepts EITHER a single `sourceUrl` (legacy) OR a `docs` array (preferred).
 * With `docs`, each doc is fetched + extracted independently so every returned
 * rule carries the correct source URL/citation. Results are merged + de-duped.
 */
export async function extractRules(params: {
  anthropic: Anthropic | null;
  cityName: string;
  scope?: string;
  sourceUrl?: string;
  docs?: CodeSourceDoc[];
  fetchImpl?: typeof fetch;
  model?: string;
}): Promise<ExtractedRule[]> {
  const {
    anthropic,
    cityName,
    scope,
    sourceUrl,
    docs,
    fetchImpl = fetch,
    model = 'claude-sonnet-4-20250514',
  } = params;

  if (!anthropic) return [];

  // Multi-doc path (preferred): fetch each .gov source, extract per-doc.
  if (docs && docs.length > 0) {
    const fetched = await fetchDocsText(docs, fetchImpl);
    if (fetched.length === 0) return [];
    const all: ExtractedRule[] = [];
    for (const f of fetched) {
      const rules = await extractFromText(
        anthropic,
        cityName,
        scope,
        f.url,
        f.text,
        model,
      );
      all.push(...rules);
    }
    // De-dupe across docs by (family|section); keep first (highest-priority doc).
    const seen = new Set<string>();
    return all.filter((r) => {
      const k = `${r.codeFamily}|${r.section}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // Legacy single-URL path.
  if (!sourceUrl) return [];
  const sourceText = await fetchSourceText(sourceUrl, fetchImpl);
  if (!sourceText || sourceText.length < 200) return [];
  return extractFromText(anthropic, cityName, scope, sourceUrl, sourceText, model);
}
