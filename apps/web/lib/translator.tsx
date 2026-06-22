'use client';

import { useCallback, useEffect, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { translate as translateApi } from './api';

// ---- Supported target languages -------------------------------------------
// `code` is sent to the backend prompt (a human-readable name works best for
// the LLM, so we use full names as the value).
export interface TranslatorLanguage {
  code: string;
  label: string;
}

export const LANGUAGES: TranslatorLanguage[] = [
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Spanish (Español)' },
  { code: 'French', label: 'French (Français)' },
  { code: 'German', label: 'German (Deutsch)' },
  { code: 'Hindi', label: 'Hindi (हिन्दी)' },
  { code: 'Chinese (Simplified)', label: 'Chinese (简体中文)' },
  { code: 'Arabic', label: 'Arabic (العربية)' },
  { code: 'Portuguese', label: 'Portuguese (Português)' },
  { code: 'Japanese', label: 'Japanese (日本語)' },
  { code: 'Korean', label: 'Korean (한국어)' },
  { code: 'Russian', label: 'Russian (Русский)' },
  { code: 'Italian', label: 'Italian (Italiano)' },
  { code: 'Vietnamese', label: 'Vietnamese (Tiếng Việt)' },
  { code: 'Tagalog', label: 'Tagalog' },
];

export const DEFAULT_LANG = 'English';

// True when the selected target means "do not translate" (English / unset).
// The language list uses human-readable codes ('English'), so the no-op
// sentinel is DEFAULT_LANG rather than the ISO 'en'.
export function isNoTranslateTarget(targetLang: string | null | undefined): boolean {
  const t = (targetLang ?? '').trim().toLowerCase();
  return t === '' || t === 'english' || t === 'en';
}

function langKey(conversationKey: string) {
  return `dbm_xlate_lang:${conversationKey}`;
}
function autoKey(conversationKey: string) {
  return `dbm_xlate_auto:${conversationKey}`;
}

// ---- Hook: per-conversation translator state -------------------------------
// Holds the chosen target language and the auto-translate flag, persisted to
// localStorage keyed by a stable conversation identifier (thread/channel/
// project id). Exposes a `translate` helper for components to call.
export interface UseTranslator {
  targetLang: string;
  setTargetLang: (lang: string) => void;
  autoTranslate: boolean;
  setAutoTranslate: (on: boolean) => void;
  translate: (text: string) => Promise<string>;
}

export function useTranslator(conversationKey: string): UseTranslator {
  const [targetLang, setTargetLangState] = useState<string>(DEFAULT_LANG);
  const [autoTranslate, setAutoTranslateState] = useState<boolean>(false);

  // Load persisted prefs when the conversation changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedLang = window.localStorage.getItem(langKey(conversationKey));
      const savedAuto = window.localStorage.getItem(autoKey(conversationKey));
      setTargetLangState(savedLang || DEFAULT_LANG);
      setAutoTranslateState(savedAuto === '1');
    } catch {
      setTargetLangState(DEFAULT_LANG);
      setAutoTranslateState(false);
    }
  }, [conversationKey]);

  const setTargetLang = useCallback(
    (lang: string) => {
      setTargetLangState(lang);
      try {
        window.localStorage.setItem(langKey(conversationKey), lang);
      } catch {
        /* ignore */
      }
    },
    [conversationKey],
  );

  const setAutoTranslate = useCallback(
    (on: boolean) => {
      setAutoTranslateState(on);
      try {
        window.localStorage.setItem(autoKey(conversationKey), on ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    [conversationKey],
  );

  const translate = useCallback(
    async (text: string) => {
      const res = await translateApi(text, targetLang);
      return res.translatedText;
    },
    [targetLang],
  );

  return {
    targetLang,
    setTargetLang,
    autoTranslate,
    setAutoTranslate,
    translate,
  };
}

// ---- Toolbar: language selector + auto-translate toggle --------------------
// Designed to wrap on small screens (flex-wrap, min-w-0) so it never forces
// horizontal overflow in the chat header.
export function TranslatorToolbar({
  translator,
  compact = false,
}: {
  translator: UseTranslator;
  compact?: boolean;
}) {
  const { targetLang, setTargetLang, autoTranslate, setAutoTranslate } =
    translator;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Languages size={14} className="text-gray-400 flex-shrink-0" />
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          aria-label="Translation language"
          className="min-w-0 max-w-[10rem] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-100"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {compact ? l.code : l.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none whitespace-nowrap">
        <input
          type="checkbox"
          checked={autoTranslate}
          onChange={(e) => setAutoTranslate(e.target.checked)}
          className="rounded border-gray-300 text-amber-500 focus:ring-amber-200"
        />
        Auto-translate
      </label>
    </div>
  );
}

// ---- Translate-on-send -----------------------------------------------------
// Shared by all three composers (DM, Channel, Project). When the conversation
// has Auto-translate ON and a non-English target selected, translate the
// outgoing text into that target before sending. Returns the fields to POST:
//   - body:         what gets stored/displayed (translation, or original)
//   - originalBody: the pre-translation text when a translation happened
//   - originalLang: 'auto' marker (server auto-detects source)
//   - failed:       true when the /translate call errored — the composer should
//                   surface a non-blocking "Couldn't translate — sent original"
//                   notice. The send still proceeds with the original text.
export interface OutgoingTranslation {
  body: string;
  originalBody: string | null;
  originalLang: string | null;
  failed: boolean;
}

export async function translateOutgoing(
  text: string,
  translator: Pick<UseTranslator, 'targetLang' | 'autoTranslate' | 'translate'>,
): Promise<OutgoingTranslation> {
  const original = text;
  const trimmed = text.trim();
  // Edge cases 1, 2, 4: no target / English target / auto off / empty -> no-op.
  if (
    !trimmed ||
    !translator.autoTranslate ||
    isNoTranslateTarget(translator.targetLang)
  ) {
    return { body: original, originalBody: null, originalLang: null, failed: false };
  }

  try {
    const translated = await translator.translate(original);
    const out = (translated ?? '').trim();
    // Edge case 3: translation came back identical (already target lang) -> no
    // "Show original" toggle, store originalBody null.
    if (!out || out === trimmed) {
      return { body: original, originalBody: null, originalLang: null, failed: false };
    }
    return { body: translated, originalBody: original, originalLang: 'auto', failed: false };
  } catch {
    // Edge case 7: key missing / translate failed -> send original, flag it.
    return { body: original, originalBody: null, originalLang: null, failed: true };
  }
}

// ---- "Show original" toggle for the sender's own sent bubbles ---------------
// Renders under a sent message that was translated on send. `body` is the shown
// translation; `originalBody` is the pre-translation text. Toggling swaps which
// one is displayed. Mirrors the visual pattern of MessageTranslation.
export function SentMessageTranslation({
  body,
  originalBody,
  className = '',
}: {
  body: string;
  originalBody: string;
  className?: string;
}) {
  const [showingOriginal, setShowingOriginal] = useState(false);
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap break-words">
        {showingOriginal ? originalBody : body}
      </div>
      <button
        type="button"
        onClick={() => setShowingOriginal((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100 underline-offset-2 hover:underline"
      >
        <Languages size={11} />
        {showingOriginal ? 'Show translation' : 'Show original'}
      </button>
    </div>
  );
}

// ---- Per-message translation block -----------------------------------------
// Renders under a message body. Provides an on-request "Translate" / "Show
// original" toggle and, when `auto` is on, translates automatically on mount /
// when the target language changes. Caches the result in component state so
// toggling never refetches.
export function MessageTranslation({
  text,
  translator,
  auto,
}: {
  text: string;
  translator: UseTranslator;
  auto: boolean;
}) {
  const { targetLang, translate } = translator;
  const [translated, setTranslated] = useState<string | null>(null);
  // Which target language the cached `translated` value belongs to.
  const [translatedFor, setTranslatedFor] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const out = await translate(text);
      setTranslated(out);
      setTranslatedFor(targetLang);
      setShowing(true);
    } catch {
      setError(true);
      setShowing(true);
    } finally {
      setLoading(false);
    }
  }, [text, translate, targetLang]);

  // Auto mode: translate when enabled or when the target language changes.
  useEffect(() => {
    if (!auto) return;
    if (loading) return;
    if (translated && translatedFor === targetLang) {
      setShowing(true);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, targetLang]);

  const onToggle = () => {
    if (showing) {
      setShowing(false);
      return;
    }
    // Reuse the cached translation if it matches the current language.
    if (translated && translatedFor === targetLang && !error) {
      setShowing(true);
      return;
    }
    run();
  };

  return (
    <div className="mt-1 px-1">
      {showing && !error && translated && (
        <div className="text-sm text-gray-700 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words mb-1">
          {translated}
        </div>
      )}
      {showing && error && (
        <div className="text-xs text-red-500 mb-1">Translation unavailable</div>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-amber-600 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            Translating…
          </>
        ) : showing && !error ? (
          'Show original'
        ) : (
          <>
            <Languages size={11} />
            Translate
          </>
        )}
      </button>
    </div>
  );
}
