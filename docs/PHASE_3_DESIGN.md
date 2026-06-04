# Phase 3 Design — Multilingual Platform + Voice Agent

**Status:** Draft / not yet scheduled
**Bundle target:** 4-6 weeks once started, one shippable release
**Predecessor:** Phase 2.5 (PR #16, merged 8fd24f0) — i18n schema foundations in place

---

## 1. Why one bundle (and not five small ones)

Each surface below depends on the others. Doing them in isolation creates throwaway work:

| Surface | Depends on |
|---|---|
| Sign-up language picker | `user.languagePreference` column + propagation |
| `next-intl` SSR | extracted UI strings, locale propagation, language picker |
| Translation pipeline | extracted strings, target-locale list |
| Per-language chat triggers | locale propagation, language picker |
| Voice agent (bidirectional, interruptible) | locale propagation, chat trigger work (uses same NLU layer), front-end audio plumbing |

Ship them as one Phase 3 release: pick one launch language (Spanish — largest non-English residential-construction market in the US), get the entire stack working end-to-end in `es-MX`, then add languages by data only.

---

## 2. Scope — what ships in Phase 3

### 2.1 User-facing
- **Sign-up language picker.** Dropdown on the sign-up form: English, Español, 日本語, Français, Deutsch. Stored as `user.languagePreference` (BCP-47, e.g. `es-MX`).
- **Persistent language switcher** in the top nav (post-sign-in), writes back to the same column.
- **All UI strings localized** via `next-intl` (SSR). Server-rendered with the right locale on first paint — no flicker.
- **Locale-correct dates, numbers, currencies, measurements** via `Intl.DateTimeFormat` / `Intl.NumberFormat` / unit auto-conversion (IMPERIAL ↔ METRIC based on `jurisdiction.measurementSystem`).
- **Chat in user's language.** User can type in `es-MX`, the model responds in `es-MX`, code-rule citations stay in their canonical English IDs (NEC 210.8(A)(6) — international standard) but the surrounding explanation is translated.
- **Voice agent (bidirectional, interruptible).** Press-to-talk button on chat. User speaks; model responds in voice + text; user can interrupt mid-response (Realtime API VAD).

### 2.2 Internal / schema
- **User.languagePreference** column (`String @db.VarChar(10)`, default `'en-US'`).
- **`postalCode`** rename of `Project.zipCode` (+ migration with column rename, backward-compatible getter for 1 release).
- **`regionCode`** rename of `Jurisdiction.state` (same pattern).
- **`Jurisdiction.geoIds`** (`Json`) — generalizes the US-only `fips` field. Stores `{ fipsCounty: '...', fipsPlace: '...' }` for US, `{ municipalityCode: '...' }` for Canada, `{ prefectureCode: '...', municipalityCode: '...' }` for JP, etc.
- **`Project.addressStructured`** (`Json`, nullable) — `{ street, locality, region, postalCode, country }` alongside the free-text `address`. Required for non-postal-code countries (Ireland, parts of UK) where the regex-based resolver fails.
- **`CodeFamily`** enum → `code_family` lookup table. Rows: `IRC`, `IBC`, `NEC`, `IECC`, `LOCAL`, `NBC` (Canada), `JIS` (Japan), `EN` (EU), etc.
- **`Translation`** table for human-curated overrides: `(locale, namespace, key, value)`. Fallback chain: human curation → DeepL machine → English source.

### 2.3 Operational
- **DeepL** as the machine-translation pipeline (better quality than Google for Romance / Germanic; supports glossaries).
- **Glossary entries** for ~50 construction terms (deck, joist, ledger, ADU, kitchen, hood, GFCI, setback, ridge, eave …). Keeps "deck" from becoming "cubierta" (boat deck) in es-MX.
- **CI gate**: any new UI string must have a key in the source-locale (`en-US`) JSON; PR fails if a hardcoded user-visible string lands.

---

## 3. Architecture

### 3.1 Frontend (web)

```
apps/web/
  messages/
    en-US.json         ← source of truth (developer-written)
    es-MX.json         ← DeepL-translated, optionally human-curated
    ja-JP.json
    fr-FR.json
    de-DE.json
  src/
    i18n/
      config.ts        ← supported locales, default
      request.ts       ← next-intl server config (reads user.languagePreference cookie)
    middleware.ts      ← locale negotiation: cookie → Accept-Language → default
    app/
      [locale]/        ← all routes nested under locale segment
        layout.tsx     ← NextIntlClientProvider
        projects/...
```

**Why `next-intl` over `react-intl` / `i18next`:** native App Router SSR support, built-in middleware, message-format ICU, RSC-aware, smallest bundle. Used by Vercel's own demos.

### 3.2 Backend (API)

- Every chat request carries `locale` (from JWT → `user.languagePreference`).
- `ChatService.detectJurisdictionIntent` becomes locale-aware: per-language trigger-word table (`en`: permit, code, GFCI…; `es`: permiso, código, GFCI…; `ja`: 許可, 法規, …). Trigger words live in `apps/api/src/modules/chat/triggers/<lang>.ts`.
- System prompt injection includes the locale: `"Respond in <locale-name>. Keep code-rule citation IDs in their original form (e.g. NEC 210.8(A)(6)). Translate the surrounding explanation only."`
- Unit conversion in `buildJurisdictionContext`: if `jurisdiction.measurementSystem === 'METRIC'`, convert `sq ft → m²`, `in → cm`, etc., before injecting into the prompt.

### 3.3 Voice agent

- **Provider:** OpenAI Realtime API (`gpt-4o-realtime`). Native WebRTC, server-side VAD, sub-300ms turn-end detection, bidirectional audio streams, interruption built-in.
- **Why not Gemini Live:** comparable quality, but Realtime API has been stable longer and integrates with the same Anthropic-style tool-calling we already use for code-rule retrieval. (Fallback option: Cartesia + Deepgram for self-hosted path if cost becomes an issue.)
- **Frontend:** WebRTC peer connection from browser → Realtime API endpoint. Press-to-talk button on chat. Audio waveform visualizer for "the model is listening / speaking" state. Hitting the button again interrupts.
- **Tool-call bridge:** the Realtime session is given the same `lookup_jurisdiction_rules(scope, jurisdictionSlug)` tool. Model calls it, gets text back, speaks the answer with citations.
- **Language detection:** session opens with `language: user.languagePreference`. Realtime API handles both STT and TTS in that language. If the user switches languages mid-sentence, Realtime VAD handles it.

### 3.4 Translation pipeline (CI)

```
1. Dev adds a new key to messages/en-US.json
2. CI job (on PR to main): run `deepl translate --glossary construction-en es de fr ja`
3. Output diff PR-bot comments with the new strings per locale
4. Human reviewer can override any string in messages/<locale>.json before merge
5. Translation table (DB) takes precedence at runtime for tenant-specific overrides
```

---

## 4. Migration plan (zero downtime)

| Step | Migration | Rollback |
|---|---|---|
| 1 | Add `User.languagePreference` (default `'en-US'`) | drop column |
| 2 | Add `Project.postalCode` (copy from `zipCode`); keep `zipCode` writable | drop column |
| 3 | Code reads new column, writes both | revert code |
| 4 | Add `Jurisdiction.regionCode` (copy from `state`); same pattern | drop column |
| 5 | Add `Jurisdiction.geoIds Json`; backfill from `fips` for US | drop column |
| 6 | Add `Project.addressStructured Json` (nullable) | drop column |
| 7 | New `code_family` table; backfill from enum; keep enum column 1 release | drop table |
| 8 | New `Translation` table | drop table |
| 9 | After 1 release: drop `zipCode`, `state`, `fips`, `CodeFamily` enum column | n/a |

Each step is independently shippable. Steps 1-2 are 1-day each. Step 9 is the only one that requires coordinated frontend + backend deploys.

---

## 5. Open questions for the user (decide before kickoff)

1. **First locale.** Default proposal is `es-MX` (largest non-English US-residential-construction segment). Alternative: `fr-CA` if Canada is the actual first non-US market.
2. **Voice budget.** Realtime API is ~$0.06/min input + ~$0.24/min output. A 10-min chat costs ~$3. Acceptable for paid tiers, gated on free tier?
3. **Translation budget.** DeepL Pro = $25/month + ~$25 per million chars. Roughly negligible compared to voice.
4. **Tenant-level locale override.** Should a contractor's white-labeled portal force a single locale, or always respect `user.languagePreference`? (My recommendation: tenant default + user override.)
5. **JIS / NBC / EN code families.** Sourcing curated code rules for the first non-US market is a separate research workstream — should we kick that off in parallel during Phase 3, or wait for Phase 4?

---

## 6. Success criteria

- A user in Mexico City signs up, picks `es-MX`, creates a project in CDMX, asks "¿necesito un permiso para una terraza de 20m²?", and gets a correct answer with translated explanation and original code-rule IDs.
- Same user toggles to voice, asks the same question out loud, interrupts the model mid-answer to clarify, and gets a coherent continuation.
- Switching language back to `en-US` on the same project shows all permit data and code rules without re-fetching from the upstream adapter.
- E2E tests cover at least: locale negotiation, SSR-correct first paint per locale, chat in 2 non-English locales, voice round-trip for one locale.
- Zero new US-only assumptions in the codebase (grep audit: no hardcoded `"US"`, `"USD"`, `"IMPERIAL"`, `"America/Chicago"` outside `defaults.ts`).

---

## 7. What we are NOT doing in Phase 3

- Right-to-left languages (Arabic, Hebrew) — Phase 4. Adds bidirectional CSS work.
- Per-locale legal/privacy review (GDPR, LGPD) — handled separately when we enter EU/LATAM.
- Multi-currency billing — separate Stripe work; Phase 4+.
- Offline / PWA support — out of scope.
- A native mobile app shell with the same i18n — out of scope (web-first).
