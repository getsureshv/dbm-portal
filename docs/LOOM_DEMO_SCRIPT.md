# DBM City Integration — Loom Demo Script

**Length target:** 5 minutes
**Branch:** `feat/city-integration-demo`
**Recorder:** Suresh
**Date:** Week of June 8–11, 2026

---

## Pre-record checklist

- [ ] API up — `curl https://dbm-portal-api.onrender.com/jurisdictions/health` returns `{ ok: true }` (or local `:4000`)
- [ ] Web up — `https://dbm-portal-web.onrender.com/projects/demo/jurisdiction` (or local `:3000`)
- [ ] Browser cache cleared / incognito
- [ ] Loom set to 1080p, mic checked, camera bubble bottom-right
- [ ] Tabs open in this order: (1) demo page, (2) API JSON in second tab, (3) GitHub PR #8, (4) optional: code editor
- [ ] If Accela creds are live, confirm a real Dallas address that returns ≥ 1 real permit (e.g. `1500 Marilla St, Dallas, TX 75201`)
- [ ] If creds NOT live, set expectation in voiceover that Dallas falls back to deterministic mocks

---

## Scene 1 — Hook (0:00 – 0:25)

**On screen:** Demo page hero with DEMO banner.

> "Hey — quick 5-minute walkthrough of the DBM city integration demo.
> The goal of this slice is to prove DBM can plug into real city permit systems and surface curated building-code rules for whatever a homeowner is trying to build. Today I'll show Dallas through Accela and Flower Mound through Shovels."

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

## Scene 3 — Dallas permits via Accela (1:00 – 2:15)

**On screen:** City dropdown defaults to Dallas, TX (Accela).

> "First city: Dallas. The adapter behind this hits Accela's Construct API — OAuth2 client-credentials, then `/v4/search/records` filtered by the Dallas agency."

**Action:** Paste `1500 Marilla St, Dallas, TX 75201` into the address field. Click **Look up permits**.

> "Permits come back from Accela, normalize into our internal shape — externalId, type, status, issuedAt, valuation, contractor — and get cached in Postgres so the next user on the same address pays no API cost."

**Action:** Switch to the second tab → hit `/jurisdictions/dallas-tx/permits?address=...`

> "Here's the raw response. Two permits on this address in our demo — both with normalized status enums and the original Accela record preserved in `raw` for debugging."

**Action:** Back to the demo page. Refresh.

> "Notice the second load is instant — we serve from `fetchedAt` cache; default TTL is 24 hours."

> *(If creds not yet provisioned:)* "Right now the Accela sandbox creds are pending — the adapter env-gates and falls back to deterministic mocks so the demo never breaks. The moment ACCELA_APP_ID and ACCELA_APP_SECRET hit Render, this turns into live data with zero code change."

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

> "Quick architecture note. One `JurisdictionAdapter` interface, three implementations: Accela, Shovels, Mock. A factory picks the adapter off the jurisdiction record's `vendor` field, so adding a new city is one row in the DB plus optionally one new adapter. The web page is a Next.js client component talking to a Nest controller; permits are persisted in Postgres for caching and replay."

---

## Scene 7 — What's next (4:45 – 5:00)

**On screen:** Back to the demo page.

> "Next two weeks: wire the third Dallas–Plano corridor city (Frisco — Velocity Hall), expand curated rules to 6 scopes, and pipe permit history into the bid-confidence score on the provider side.
>
> PR is open at github.com/getsureshv/dbm-portal/pull/8 — happy to walk anyone through the code. That's it, thanks."

---

## Cuts to keep tight

- Skip Scene 6 if running long — it's the only optional one.
- The Scene 3 "raw JSON tab" detour is 15s — drop if pressed.
- Don't read the rule bodies aloud; let viewers scan.

## Backup talking points (only if asked)

- **Cost?** API calls cached 24h in Postgres → marginal cost ~zero per address after first hit. Accela sandbox is free; Shovels is metered, we'll budget once volume is real.
- **Why not just scrape city portals?** Accela is the system of record for ~30% of US permitting jurisdictions including Dallas — going direct is faster and legal. For non-Accela cities, Shovels is licensed access to the same underlying data.
- **Coverage roadmap?** Wave 1: Dallas, FM, Frisco. Wave 2: Plano, Lewisville, Carrollton. Wave 3: Houston ILMS, Austin AB+C.
- **Why a "scope" picker vs free-text?** Curation. We hand-tag rules to scopes; LLM scope inference comes later but it's not blocking the demo.
