# DBM City Integration — Demo Status

**Target ship date:** Thursday, June 11, 2026
**Audit date:** Thursday, June 4, 2026
**Branch:** `main` (PR #8 squash-merged from `feat/city-integration-demo`; PR #10 added FM rule top-up)

## Live URLs

- Demo page: https://dbm-portal-web.onrender.com/projects/demo/jurisdiction
- API health: https://dbm-portal-api.onrender.com/jurisdictions/health
- API list: https://dbm-portal-api.onrender.com/jurisdictions

## Objective audit

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Working page hit-able from Render or local | ✅ Done | https://dbm-portal-web.onrender.com/projects/demo/jurisdiction returns 200 with DEMO banner, city picker, scope picker, code rules section |
| 2 | Real Dallas permits | ❌ Blocked | `ACCELA_APP_ID` / `ACCELA_APP_SECRET` not yet provided. Adapter falls back to deterministic mock. Health endpoint reports: `"ACCELA_APP_ID / ACCELA_APP_SECRET unset"` |
| 3 | Flower Mound permits real-or-mock | ✅ Done | Mock fallback active (`SHOVELS_API_KEY` unset). Real Shovels path code-complete; will flip on env var. |
| 4 | 2-3 code rules per scope | ✅ Done | Dallas: deck=3, adu=3, kitchen=2, solar=2. Flower Mound: deck=2, adu=2, kitchen=2, solar=2 (after PR #10) |
| 5 | DEMO disclaimer banner | ✅ Done | Banner visible on every page load; orange chrome `apps/web/app/(auth)/projects/[id]/jurisdiction/page.tsx` |
| 6 | 5-minute Loom recording | ❌ Pending | Script written at `docs/LOOM_DEMO_SCRIPT.md`. Recording is a human-only task (Suresh records). |
| 7 | PR ready or merged | ✅ Done | PR #8 squash-merged into main as `fc7d738`. PR #10 squash-merged as `c7b438b`. |

## Remaining work to ship

### 1. Wire Accela sandbox credentials (unblocks requirement #2)

**Where to set:** Render dashboard → `dbm-portal-api` service → Environment

```
ACCELA_APP_ID=<from developer.accela.com app>
ACCELA_APP_SECRET=<from developer.accela.com app>
ACCELA_ENV=Sandbox
ACCELA_AGENCY=DALLAS_TX
```

**Verify after setting:**
```bash
curl https://dbm-portal-api.onrender.com/jurisdictions/health
# expect dallas-tx entry: { "ok": true, "detail": "..." }

curl "https://dbm-portal-api.onrender.com/jurisdictions/dallas-tx/permits?address=1500+Marilla+St,+Dallas,+TX+75201"
# expect externalId values WITHOUT the "MOCK-DALLAS-TX-" prefix
```

### 2. (Optional) Wire Shovels.ai key (upgrades FM from mock to real)

```
SHOVELS_API_KEY=<from shovels.ai dashboard>
```

Not strictly required by the objective ("real-or-mock"), but recommended.

### 3. Record the Loom

Open `docs/LOOM_DEMO_SCRIPT.md`. 5 minutes, scene-by-scene script with addresses + voiceover lines. Once recorded, paste the Loom URL into the README / share with stakeholders.

## What's already proven on Render right now

```
$ curl https://dbm-portal-api.onrender.com/jurisdictions
[
  { "slug": "dallas-tx",       "vendor": "ACCELA",  "name": "Dallas, TX" },
  { "slug": "flower-mound-tx", "vendor": "SHOVELS", "name": "Flower Mound, TX" },
  { "slug": "houston-tx",      "vendor": "MOCK",    "name": "Houston, TX" }
]

$ curl https://dbm-portal-api.onrender.com/jurisdictions/dallas-tx/permits?address=1500+Marilla+St,+Dallas,+TX+75201
{ "permits": [
    { "externalId": "MOCK-DALLAS-TX-SEH741", "type": "Kitchen Remodel", "status": "FINALIZED" },
    { "externalId": "MOCK-DALLAS-TX-SEH740", "type": "Residential Deck", "status": "ISSUED"    }
] }
```

End-to-end demo works on mock data today. Flipping to real data is one env-var change away.

## Cost / risk notes

- Mock adapters are deterministic and free — no API spend until creds land
- Permit responses cache in Postgres for 24h via `Permit.fetchedAt`, so first hit per address is the only paid API call against Accela/Shovels
- The `JurisdictionAdapter` interface keeps real and mock implementations interchangeable, so flipping cities back to mock for cost control is trivial
