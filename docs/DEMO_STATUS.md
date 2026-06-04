# DBM City Integration — Demo Status

**Target ship date:** Thursday, June 11, 2026
**Audit date:** Thursday, June 4, 2026
**Branch:** `main` (latest PR #14 — Houston real via Shovels, on top of PRs #8, #10, #11, #12, #13)

## Live URLs

- Demo page: https://dbm-portal-web.onrender.com/projects/demo/jurisdiction
- API health: https://dbm-portal-api.onrender.com/jurisdictions/health
- API list: https://dbm-portal-api.onrender.com/jurisdictions
- Dallas dataset (source of truth): https://www.dallasopendata.com/d/e7gq-4sah

## Objective audit

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Working page hit-able from Render or local | ✅ Done | https://dbm-portal-web.onrender.com/projects/demo/jurisdiction returns 200 with DEMO banner, city picker, scope picker, code rules section |
| 2 | Real Dallas permits | ✅ Done | `DallasOpenDataAdapter` (PR #12) queries Socrata dataset `e7gq-4sah` — no auth required. Verified locally: 23 real records for `1500 Marilla St` with real permit numbers, contractors, and work descriptions. |
| 3 | Flower Mound permits real-or-mock | ✅ **Real** | `ShovelsAdapter` (PR #13) wired to Shovels.ai v2 — verified locally returning 25 real FM permits for zip 75028 dated 2026-05-22. Will flip on Render when `SHOVELS_API_KEY` env var lands. |
| 4 | 2-3 code rules per scope | ✅ Done | Dallas: deck=3, adu=3, kitchen=2, solar=2. Flower Mound: deck=2, adu=2, kitchen=2, solar=2. **Houston (NEW): deck=2, adu=3, kitchen=2, solar=2** (PR #14). |
| 5 | DEMO disclaimer banner | ✅ Done | Banner visible on every page load; orange chrome `apps/web/app/(auth)/projects/[id]/jurisdiction/page.tsx` |
| 6 | 5-minute Loom recording | ❌ Pending | Script written at `docs/LOOM_DEMO_SCRIPT.md`. Recording is a human-only task (Suresh records). |
| 7 | PR ready or merged | ✅ Done | PRs #8, #10, #11, #12, #13, #14 all squash-merged into `main`. `feat/chat-jurisdiction-aware` (Scene 5c) open as the next PR. |
| 8 | **BONUS** — DBM chat can answer code/permit questions inline | ✅ Done | Intent-routed retrieval in `ChatService`: regex detects code/permit intent, resolves jurisdiction from `Project.zipCode`, infers scope from project type + scope text + user message, prepends a `─── JURISDICTION CONTEXT ───` block with curated rules + 5 most recent permits to Claude's system prompt. Six override rules force the model to cite real IDs and skip `<scope_update>` extraction. Acceptance: all 3 cities pass `scripts/test-chat-jurisdiction.ts`. |

## Why Dallas OpenData instead of Accela?

Accela's Construct API requires per-agency partnership credentials — and Dallas's `DALLASTX` agency is gated behind a partnership review process that doesn't fit a 1-week demo timeline. Dallas OpenData publishes the same underlying data — building permits issued — on Socrata as dataset `e7gq-4sah`, fully public with no auth. This bypass is **the right answer for the demo**, and the Accela adapter is preserved in the codebase for future cities that grant credentials.

**Trade-off:** the OpenData dataset is primarily 2019 vintage (Dallas has not refreshed the OpenData feed lately). For the demo this is fine — the data is genuine City of Dallas permit records, addresses and contractors are real, and the integration shape is identical to what a fresh feed would look like.

## What's now proven on Render

```
$ curl https://dbm-portal-api.onrender.com/jurisdictions
[
  { "slug": "dallas-tx",       "vendor": "DALLAS_OPENDATA", "name": "City of Dallas" },
  { "slug": "flower-mound-tx", "vendor": "SHOVELS",         "name": "Town of Flower Mound" },
  { "slug": "houston-tx",      "vendor": "SHOVELS",         "name": "City of Houston" }
]

$ curl "https://dbm-portal-api.onrender.com/jurisdictions/dallas-tx/permits?address=1500+Marilla+St,+Dallas,+TX+75201"
{ "permits": [
    { "externalId": "1912235004", "type": "Building (BU) Commercial Alteration", "status": "ISSUED",
      "contractor": "MILLER PRO AUDIO LLC ...", "description": "TEMPORARY STRUCTURE FOR CONCERT ..." },
    { "externalId": "1911141001", "type": "Building (BU) Commercial Renovation", "status": "ISSUED", ... },
    ... 21 more
] }
```

End-to-end demo with **real Dallas permit data** works on Render. No env-var change required.

## Remaining work to ship

### 1. Set `SHOVELS_API_KEY` env var on Render

Render dashboard → `dbm-portal-api` service → Environment → add:

```
SHOVELS_API_KEY=<key from shovels.ai dashboard>
```

Key is ready and verified locally. Once set on Render, FM flips from deterministic mock → real recent permits (last 5 years, 100/request max on free tier).

### 2. Record the Loom (human-only)

Open `docs/LOOM_DEMO_SCRIPT.md`. 5 minutes, scene-by-scene script with addresses + voiceover lines. Once recorded, paste the Loom URL into the README / share with stakeholders.

## Cost / risk notes

- Dallas OpenData is free, no auth, no rate limit caps for this demo's traffic (optional `DALLAS_OPENDATA_APP_TOKEN` raises throttling thresholds if needed)
- Permit responses cache in Postgres for 24h via `AddressLookup.ttlSeconds`, so first hit per address is the only outbound call against any upstream
- The `JurisdictionAdapter` interface keeps real, mock, OpenData, and Accela implementations interchangeable, so swapping cities back to mock for cost control is trivial
- Accela adapter preserved in `apps/api/src/modules/jurisdictions/adapters/accela.adapter.ts` for any city that grants partnership credentials in the future
