/**
 * Direct Anthropic Messages API client using Node's BUILT-IN native fetch
 * (Node 18+; confirmed working on the Node 22 runtime in prod).
 *
 * Why this exists: the installed @anthropic-ai/sdk uses the legacy
 * node-fetch@2 polyfill, which mishandles Anthropic's gzip-compressed response
 * on Node 22 and closes the stream prematurely
 * (`ERR_STREAM_PREMATURE_CLOSE` / "Premature close"). Every SDK call fails as a
 * result, while native fetch handles the gzip response correctly. This helper
 * bypasses node-fetch@2 entirely.
 *
 * Do NOT set an Accept-Encoding header — native fetch negotiates and decodes
 * compression on its own. anthropic-version is pinned to the value confirmed
 * working in live testing.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export type AnthropicTextBlock = { type: 'text'; text: string };
export type AnthropicContentBlock = AnthropicTextBlock | { type: string; [k: string]: unknown };

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  // string for plain text, or an array of content blocks (image/document/text)
  content: string | AnthropicContentBlock[];
}

export interface CallAnthropicParams {
  apiKey: string;
  model: string;
  maxTokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
}

export interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  [k: string]: unknown;
}

export interface CallAnthropicResult {
  /** Concatenated text from every text block in the response. */
  text: string;
  /** The full parsed JSON response, for callers that need more than text. */
  raw: AnthropicResponse;
}

/**
 * Single non-streaming request to the Anthropic Messages API via native fetch.
 * Throws an Error (with the real HTTP status + body) on a non-2xx response so
 * callers can log the true cause; the caught failure should be logged server
 * side via console.error.
 */
export async function callAnthropic(
  params: CallAnthropicParams,
): Promise<CallAnthropicResult> {
  const { apiKey, model, maxTokens, messages, system, temperature } = params;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (system != null) body.system = system;
  if (temperature != null) body.temperature = temperature;

  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Anthropic ${r.status}: ${errText}`);
  }

  const data = (await r.json()) as AnthropicResponse;
  const text = extractText(data);
  return { text, raw: data };
}

/** Concatenate the text from every `text` block in a response. */
export function extractText(data: AnthropicResponse): string {
  return (data.content ?? [])
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
