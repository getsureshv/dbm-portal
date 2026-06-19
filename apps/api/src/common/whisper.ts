/**
 * OpenAI Whisper transcription via Node's BUILT-IN native fetch + FormData
 * (Node 18+; confirmed working on the Node 22 runtime in prod). Mirrors the
 * native-fetch approach in anthropic.ts to avoid the node-fetch@2 polyfill.
 *
 * Endpoint: POST https://api.openai.com/v1/audio/transcriptions
 * Body: multipart/form-data with `file` (the audio bytes) + `model`.
 * Verified in prod with model `whisper-1` (HTTP 200, returned text).
 */

const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_WHISPER_MODEL = 'whisper-1';

export interface TranscribeParams {
  apiKey: string;
  /** Raw audio bytes fetched from R2. */
  audio: Buffer | Uint8Array;
  /** A filename with the right extension so OpenAI can sniff the container. */
  fileName: string;
  /** The audio MIME type (used for the Blob). */
  mime: string;
  /** Whisper model id; env-configurable. */
  model?: string;
  /** Override the OpenAI base URL (env-configurable). */
  baseUrl?: string;
}

/**
 * Single transcription request. Throws an Error carrying the real HTTP status +
 * body on a non-2xx response so the caller can log the true cause.
 */
export async function transcribeAudio(
  params: TranscribeParams,
): Promise<{ text: string }> {
  const {
    apiKey,
    audio,
    fileName,
    mime,
    model = DEFAULT_WHISPER_MODEL,
    baseUrl = DEFAULT_OPENAI_BASE,
  } = params;

  const form = new FormData();
  // Wrap in a Blob so the multipart part carries a content-type + filename.
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the BlobPart type is
  // unambiguous across Node lib versions.
  const view = new Uint8Array(audio.byteLength);
  view.set(audio);
  form.append('file', new Blob([view], { type: mime }), fileName);
  form.append('model', model);

  const url = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`OpenAI ${r.status}: ${errText}`);
  }

  const data = (await r.json()) as { text?: string };
  return { text: data.text ?? '' };
}
