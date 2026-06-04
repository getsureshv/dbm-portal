# DBM City Integration — Loom Demo Script

**Length target:** 5 minutes
**Branch:** `main` (PR #12 — Dallas OpenData live)
**Recorder:** Suresh
**Date:** Week of June 8–11, 2026

---

## Pre-record checklist

- [ ] API up — `curl https://dbm-portal-api.onrender.com/jurisdictions/health` returns `{ ok: true }` (or local `:4000`)
- [ ] Web up — `https://dbm-portal-web.onrender.com/projects/demo/jurisdiction` (or local `:3000`)
- [ ] Browser cache cleared / incognito
- [ ] Loom set to 1080p, mic checked, camera bubble bottom-right
- [ ] Tabs open in this order: (1) demo page, (2) API JSON in second tab, (3) GitHub PR #8, (4) optional: code editor
- [ ] Confirm Dallas returns real permits for `1500 Marilla St, Dallas, TX 75201` — externalId should be a numeric `permit_number` (not `MOCK-DALLAS-TX-…`)
- [ ] Confirm `/jurisdictions/health` shows `dallas-tx` with `vendor: DALLAS_OPENDATA` and `ok: true`

---

## Scene 1 — Hook (0:00 – 0:25)

**On screen:** Demo page hero with DEMO banner.

> "Hey — quick 5-minute walkthrough of the DBM city integration demo.
> The goal of this slice is to prove DBM can plug into real city permit systems and surface curated building-code rules for whatever a homeowner is trying to build. Today I'll show Dallas through the City of Dallas OpenData feed and Flower Mound through Shovels."

**Mouse action:** Hover the orange "DEMO — sample data" banner so it's obvious nothing here is binding.

---

## Scene 2 — Why this matters (0:25 – 1:00)

**On screen:** Stay on the page.

> "Two things matter for homeowners and providers in DBM:
> 1. *What's already been permitted at this address?* — drives scope, risk, and bid accuracy.
> 2. *What rules will actually apply to MY project?* — a deck has different setbacks and fastener rules than an ADU.
>
> Most portals stop at #1 and dump a PDF of the building code on you. We're collapsing both into one address-aware view."

---

## Scene 3 — Dallas permits via OpenData (1:00 – 2:15)

**On screen:** City dropdown defaults to City of Dallas (DALLAS_OPENDATA).

> "First city: Dallas. The adapter behind this hits the official City of Dallas OpenData portal — Socrata API, public dataset `e7gq-4sah`, no authentication required. This is the same source the city itself publishes; about 56,000 permit records."

**Action:** Paste `1500 Marilla St, Dallas, TX 75201` into the address field. Click **Look up permits**.

> "That address is Dallas City Hall — and you can see real permits come back: electrical alterations for stage events, commercial renovations, real contractors like Miller Pro Audio and Wired Up Electric, real work descriptions. Everything normalizes into our internal shape — externalId, type, status, issuedAt, valuation, contractor — and gets cached in Postgres so the next user on the same address pays no API cost."

**Action:** Switch to the second tab → hit `/jurisdictions/dallas-tx/permits?address=...`

> "Here's the raw response. Every record has a real `permit_number` from the city, and the full Socrata record is preserved in `raw` for debugging."

**Action:** Back to the demo page. Refresh.

> "Notice the second load is instant — we serve from cache; default TTL is 24 hours."

> *(Aside — only if asked about Accela:)* "We considered Accela's Construct API, but their Dallas agency is gated behind a partnership review. OpenData publishes the same underlying data publicly, so for the demo this is the faster and more reliable path. The Accela adapter is still in the codebase for cities that grant credentials."

---

## Scene 4 — Flower Mound via Shovels (2:15 – 3:00)

**On screen:** Switch city dropdown to Flower Mound, TX (Shovels).

> "Second city: Flower Mound. Smaller municipality, no Accela tenant — we use Shovels.ai, which aggregates permits across thousands of US jurisdictions through a single REST API."

**Action:** Paste a Flower Mound address (e.g. `4150 Long Prairie Rd, Flower Mound, TX 75028`). Click **Look up permits**.

> "Under the hood: address-to-geo_id lookup on `/v2/addresses/search`, then a 5-year window pull from `/v2/permits/search`. Same normalized shape comes out the other end — that's the whole point of the adapter pattern."

> *(If Shovels key not provisioned:)* "Same fallback behavior — mocks stand in until the API key lands."

---

## Scene 5 — Code rules by project scope (3:00 – 4:15)

**On screen:** Switch back to Dallas. Scope selector visible.

> "Now the part most portals miss — code rules curated to the project."

**Action:** Click **Add a deck**.

> "Three rules curated by us for a residential deck in Dallas:
> - IRC R507.2 — materials and fastener requirements
> - IRC R507.9 — ledger attachment, the #1 cause of deck collapse
> - And a Dallas-specific zoning rule, DCC §51A — setbacks for accessory structures over 30 inches."

**Action:** Click **Build an ADU**.

> "Switch to ADU — rules change. Now you see fire-separation requirements, occupancy classification, and a parking-waiver carve-out specific to Dallas."

**Action:** Click **Kitchen remodel**.

> "Kitchen remodel — load-bearing wall permit triggers, GFCI receptacle requirements, ventilation."

> "Each rule has a `sourceUrl` deep-link to ICC or the city code so a provider or inspector can verify. Curation is hand-done today, scoped to 3 cities × 4 project types. Long-term that becomes an LLM-assisted ingest off official code PDFs — but we wanted humans in the loop for the first 12 cities."

---

## Scene 6 — Architecture in 30 seconds (4:15 – 4:45)

**On screen:** Quick switch to GitHub PR #8 → scroll the file tree.

> "Quick architecture note. One `JurisdictionAdapter` interface, four implementations: Dallas OpenData, Accela, Shovels, Mock. A factory picks the adapter off the jurisdiction record's `vendor` field, so adding a new city is one row in the DB plus optionally one new adapter. Each adapter has a graceful mock fallback so an upstream outage never breaks the demo. The web page is a Next.js client component talking to a Nest controller; permits are persisted in Postgres for caching and replay."

---

## Scene 7 — What's next (4:45 – 5:00)

**On screen:** Back to the demo page.

> "Next two weeks: wire the third Dallas–Plano corridor city (Frisco — Velocity Hall), expand curated rules to 6 scopes, and pipe permit history into the bid-confidence score on the provider side.
>
> PRs are merged at github.com/getsureshv/dbm-portal — the Dallas real-data work is PR #12 on top of #8, #10, #11. Happy to walk anyone through the code. That's it, thanks."

---

## Cuts to keep tight

- Skip Scene 6 if running long — it's the only optional one.
- The Scene 3 "raw JSON tab" detour is 15s — drop if pressed.
- Don't read the rule bodies aloud; let viewers scan.

## Backup talking points (only if asked)

- **Cost?** Dallas OpenData is free and unauthenticated. API calls cached 24h in Postgres → marginal cost ~zero per address after first hit. Shovels is metered, we'll budget once volume is real.
- **Why OpenData over Accela for Dallas?** Same underlying data, but OpenData is public and Accela's Dallas agency requires partnership credentials. For other Accela-only cities we use the Accela adapter (still in the repo). For non-Accela / non-OpenData cities, Shovels is licensed access to the same underlying data.
- **How fresh is the Dallas OpenData feed?** The current public snapshot is primarily 2019 vintage — Dallas has not refreshed the OpenData publication lately. Data is real, but for live freshness in production we'd combine OpenData with Accela partnership credentials or a direct city feed.
- **Coverage roadmap?** Wave 1: Dallas, FM, Frisco. Wave 2: Plano, Lewisville, Carrollton. Wave 3: Houston ILMS, Austin AB+C.
- **Why a "scope" picker vs free-text?** Curation. We hand-tag rules to scopes; LLM scope inference comes later but it's not blocking the demo.
