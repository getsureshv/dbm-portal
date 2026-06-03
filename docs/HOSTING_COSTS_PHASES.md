# dbm-portal — Hosting Costs by Phase × Customer Tier

**Date:** 2026-06-03
**Companion to:** [HOSTING_COSTS.md](./HOSTING_COSTS.md), [HOSTING_COSTS_CLOUDS.md](./HOSTING_COSTS_CLOUDS.md)
**Source for phase definitions:** `DBM-website-app-development.xlsx` → "Work flow for user" sheet.

The XLSX defines **7 phases** in the customer journey (not 5 — I'll honor the source). Each phase adds new functionality that lights up new cost line items. Earlier docs modeled Phase 1 only. This doc extends them.

---

## 1. Phases as defined in the spec

| # | Phase name | Capability | Key artifacts |
|---|---|---|---|
| **1** | Find the required contact | Search engine; pro/supplier/freight directory | Discovery, search, profiles, registration forms |
| **2** | Get bids | Bid forms, upload bid documents, scope of work, checklists | Document upload + AI scan (Phase 1 already supports this) |
| **3** | Compare and finalize bids | Bid comparison tools | Side-by-side comparison, scoring, normalization |
| **4** | Sign Contract / Agreement | Contract forms, autofill from bid, scope + legal documents, DocuSign integration | E-signature, PDF generation, version control |
| **5** | Execute Contract / Agreement | Trackables, schedule, budget, scope, change orders, supplies/inventory/lead times, payments/invoices, RFIs, submittals, progress reports | Project management, payments, file collaboration, real-time status |
| **6** | Close Contract | Checklists, punchlists, lien releases | Workflow automation, document storage |
| **7** | Reviews / testimonials / Lessons learnt | Public reviews, NPS, lessons-learnt archive | Review system, moderation, search index |

Today the app implements roughly **Phase 1 + early Phase 2** (registration, search, document upload, AI scan, scope architect). Everything from Phase 3 onward is net-new work.

---

## 2. Cost lens — phases multiply the cost surface, tiers multiply each line

A useful mental model:

```
Total $/mo = (Phase 1 baseline) + (Phase add-ons) × (customer-tier scaling)
```

Compute and DB scale with **users**. New phases add fundamentally new **services** — payments, signatures, real-time, messaging, search index. Many of these introduce **per-event** or **per-transaction** charges that don't show up at all in Phase 1.

---

## 3. Per-phase added cost lines (vendor-neutral)

What each phase introduces on top of Phase 1's stack.

### Phase 1 (today) — baseline
- Render web + API + Postgres, Cloudflare R2, Firebase Auth, Anthropic Claude.
- Already covered in HOSTING_COSTS.md.

### Phase 2 — Get bids
New work but mostly same primitives. Heavier R2 + DB usage.
- More document uploads per project (bids include drawings, specs, photos)
- More Claude scans per project
- **Net added monthly cost: 30-50% more R2, ~2x more Claude per project**
- New vendors needed: none

### Phase 3 — Compare and finalize bids
Compute-heavy, no new vendors.
- Side-by-side bid comparison renders → bigger payloads (bandwidth +20%)
- Structured extraction with Claude (normalize line items across bids) → significant LLM cost increase per project
- **Net added: ~3x more Claude per project than Phase 1**, modest compute
- New vendors needed: none

### Phase 4 — Sign Contract
Introduces e-signature and legal-document handling.
- **DocuSign / Dropbox Sign:** ~$25/mo base + $1.50-3 per envelope, or Dropbox Sign $20/mo + $0.30/envelope. Budget ~$0.50-3 per signed contract.
- **PDF generation:** Puppeteer/Chromium on a worker container (~$10-50/mo compute) or [DocRaptor](https://docraptor.com) at $0.04-0.20/doc
- **WORM/long-term retention** for signed contracts (regulatory): R2 lifecycle to Infrequent Access ($0.01/GB-month vs $0.015)
- **Net added: $50-500/mo at the per-contract level**, scales with deal volume not users
- New vendors needed: DocuSign or Dropbox Sign

### Phase 5 — Execute Contract (the heaviest phase)
This is where the cost curve bends up sharply because real-time, payments, messaging, and project management all land at once.

| Sub-feature | Vendor / approach | Typical cost |
|---|---|---|
| Schedule / Gantt | In-app, Postgres + UI lib | Free (compute only) |
| Budget tracking | In-app | Free |
| Change orders | In-app + e-sign | Adds to DocuSign volume |
| Supplies / inventory / lead times | In-app or [Procore-style](https://www.procore.com) integration | Free or $/mo per integration |
| **Payments / invoices** | **[Stripe Connect](https://stripe.com/connect)** 2.9% + $0.30/txn (homeowner→pro); platform fee skim is your revenue | Stripe fees are passed through; budget ~$0 hosting but +backend dev |
| **RFI / Submittals / Progress reports** | In-app, file-heavy | R2 growth +200-400% |
| **Real-time status / messaging** | [Pusher](https://pusher.com)/[Ably](https://ably.com) or self-hosted Socket.io | $49-499/mo at scale |
| Photo uploads from job site (mobile) | Mobile app + R2 | Mobile dev cost, modest hosting |
| Notifications (email + SMS + push) | [SendGrid](https://sendgrid.com)/Postmark $10-400, Twilio $0.0079/SMS US, [Expo Push](https://docs.expo.dev/push-notifications/overview/) free | $30-2,000/mo at scale |
| Background jobs (reminders, status rollups) | [BullMQ](https://docs.bullmq.io) on [Render Key Value](https://render.com/docs/key-value) or Redis | $25-200/mo |

- **Net added: $200-3,000/mo** depending on tier
- New vendors needed: Stripe, Pusher or Ably (or self-host), SendGrid or Postmark, Twilio (if SMS), Redis

### Phase 6 — Close Contract
Lighter than Phase 5.
- Workflow automation engine (in-app) — compute light
- Lien release documents — adds to DocuSign volume
- Final-payment escrow release — Stripe Connect already covers it
- **Net added: minor, mostly Stripe volume + a bit more storage**
- New vendors needed: none

### Phase 7 — Reviews / testimonials / Lessons learnt
Moderation and search become real costs.
- **Search index:** Postgres full-text is free; [Algolia](https://www.algolia.com/pricing) $1/1000 records + $0.50/1000 queries, or [Meilisearch Cloud](https://www.meilisearch.com/pricing) $30-500/mo
- **Content moderation:** [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation) is free; Claude moderation at standard rates; human moderator time at scale
- **Photo/video moderation:** [AWS Rekognition](https://aws.amazon.com/rekognition/pricing/) or [Hive Moderation](https://thehive.ai) — $0.001-0.005/image
- **Public review pages = SEO traffic surge:** bandwidth +50-200%
- **Net added: $50-1,500/mo** depending on tier and how much moderation you automate vs human-review
- New vendors needed: search (optional), moderation API (recommended)

---

## 4. The full grid — $/month per (phase × customer tier)

Reads as **cumulative monthly cost** if you've shipped through that phase. Each cell includes all earlier phases.

LLM line is shown **optimized** (prompt caching + Haiku for scans) per HOSTING_COSTS.md recommendation. Headcount excluded. Render hosting assumed (cheapest at Tier B-D per HOSTING_COSTS_CLOUDS.md).

### Tier A — Pilot (30 MAU)

| Line item | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Render compute + DB + bandwidth | 23 | 25 | 26 | 28 | 45 | 47 | 50 |
| Cloudflare R2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Anthropic Claude (optimized) | 5 | 8 | 15 | 16 | 18 | 18 | 19 |
| Firebase Auth | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DocuSign / Dropbox Sign | — | — | — | 25 | 30 | 35 | 35 |
| Stripe Connect | — | — | — | — | passthrough | passthrough | passthrough |
| Pusher / real-time | — | — | — | — | 0 (free tier) | 0 | 0 |
| Email/SMS/Push | — | — | — | — | 10 | 10 | 15 |
| Redis (queues) | — | — | — | — | 25 | 25 | 25 |
| Search / moderation | — | — | — | — | — | — | 20 |
| Security + observability | 0 | 0 | 0 | 0 | 25 | 25 | 25 |
| Incidentals | 2 | 2 | 2 | 4 | 10 | 12 | 15 |
| **Tier A cumulative** | **30** | **35** | **43** | **73** | **163** | **172** | **204** |

### Tier B — Small (500 MAU)

| Line item | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Render compute + DB + bandwidth | 137 | 145 | 155 | 165 | 210 | 215 | 230 |
| Cloudflare R2 | 1 | 2 | 2 | 3 | 8 | 9 | 11 |
| Anthropic Claude (optimized) | 79 | 130 | 240 | 260 | 290 | 290 | 310 |
| Firebase Auth | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DocuSign / Dropbox Sign | — | — | — | 80 | 150 | 220 | 220 |
| Stripe Connect | — | — | — | — | passthrough | passthrough | passthrough |
| Pusher / real-time | — | — | — | — | 49 | 49 | 49 |
| Email/SMS/Push | — | — | — | — | 50 | 60 | 90 |
| Redis (queues) | — | — | — | — | 25 | 25 | 25 |
| Search / moderation | — | — | — | — | — | — | 80 |
| Security + observability | 51 | 51 | 51 | 75 | 120 | 120 | 150 |
| Incidentals | 56 | 56 | 56 | 75 | 110 | 120 | 150 |
| **Tier B cumulative** | **324** | **384** | **504** | **658** | **1,012** | **1,108** | **1,315** |

### Tier C — Medium (4,000 MAU)

| Line item | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Render compute + DB + bandwidth | 754 | 800 | 850 | 920 | 1,200 | 1,240 | 1,320 |
| Cloudflare R2 | 9 | 14 | 14 | 22 | 60 | 65 | 75 |
| Anthropic Claude (optimized) | 630 | 1,050 | 1,920 | 2,070 | 2,310 | 2,310 | 2,470 |
| Firebase Auth | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DocuSign / Dropbox Sign | — | — | — | 350 | 800 | 1,150 | 1,150 |
| Stripe Connect | — | — | — | — | passthrough | passthrough | passthrough |
| Pusher / real-time | — | — | — | — | 199 | 199 | 199 |
| Email/SMS/Push | — | — | — | — | 250 | 300 | 450 |
| Redis (queues) | — | — | — | — | 75 | 75 | 75 |
| Search / moderation | — | — | — | — | — | — | 350 |
| Security + observability | 400 | 400 | 400 | 500 | 700 | 700 | 800 |
| Incidentals | 187 | 187 | 187 | 230 | 350 | 380 | 480 |
| **Tier C cumulative** | **1,980** | **2,451** | **3,371** | **4,092** | **5,944** | **6,419** | **7,369** |

### Tier D — Large (20,000 MAU)

| Line item | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Render compute + DB + bandwidth | 2,161 | 2,300 | 2,440 | 2,610 | 3,300 | 3,400 | 3,610 |
| Cloudflare R2 | 45 | 70 | 70 | 110 | 290 | 320 | 380 |
| Anthropic Claude (optimized) | 3,150 | 5,250 | 9,600 | 10,350 | 11,550 | 11,550 | 12,350 |
| Firebase Auth | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DocuSign / Dropbox Sign | — | — | — | 1,200 | 3,000 | 4,300 | 4,300 |
| Stripe Connect | — | — | — | — | passthrough | passthrough | passthrough |
| Pusher / real-time | — | — | — | — | 499 | 499 | 499 |
| Email/SMS/Push | — | — | — | — | 900 | 1,100 | 1,600 |
| Redis (queues) | — | — | — | — | 200 | 200 | 200 |
| Search / moderation | — | — | — | — | — | — | 900 |
| Security + observability | 1,080 | 1,080 | 1,080 | 1,300 | 1,800 | 1,800 | 2,000 |
| Incidentals | 582 | 582 | 582 | 720 | 1,100 | 1,200 | 1,500 |
| **Tier D cumulative** | **7,018** | **9,282** | **13,772** | **16,290** | **22,639** | **24,369** | **27,339** |

### Tier E — Viral (100,000 MAU)

| Line item | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Render compute + DB + bandwidth | 7,074 | 7,500 | 7,950 | 8,500 | 10,500 | 10,800 | 11,400 |
| Cloudflare R2 | 225 | 350 | 350 | 550 | 1,450 | 1,600 | 1,900 |
| Anthropic Claude (optimized) | 15,750 | 26,250 | 48,000 | 51,750 | 57,750 | 57,750 | 61,750 |
| Firebase Auth | 275 | 275 | 275 | 275 | 275 | 275 | 275 |
| DocuSign / Dropbox Sign | — | — | — | 5,000 | 12,000 | 17,000 | 17,000 |
| Stripe Connect | — | — | — | — | passthrough | passthrough | passthrough |
| Pusher / real-time | — | — | — | — | 1,500 | 1,500 | 1,500 |
| Email/SMS/Push | — | — | — | — | 4,500 | 5,500 | 8,000 |
| Redis (queues) | — | — | — | — | 600 | 600 | 600 |
| Search / moderation | — | — | — | — | — | — | 4,500 |
| Security + observability | 3,350 | 3,350 | 3,350 | 4,000 | 5,500 | 5,500 | 6,200 |
| Incidentals | 1,752 | 1,752 | 1,752 | 2,200 | 3,200 | 3,600 | 4,400 |
| **Tier E cumulative** | **28,426** | **39,477** | **61,677** | **72,275** | **97,275** | **104,125** | **117,525** |

---

## 5. Summary table — pick your row and column

Monthly hosting + ops cost (USD, excludes headcount, optimized Claude):

| Customer tier ↓ \ Phase → | **P1** | **P2** | **P3** | **P4** | **P5** | **P6** | **P7** |
|---|---:|---:|---:|---:|---:|---:|---:|
| **A. Pilot** | 30 | 35 | 43 | 73 | 163 | 172 | 204 |
| **B. Small** | 324 | 384 | 504 | 658 | 1,012 | 1,108 | 1,315 |
| **C. Medium** | 1,980 | 2,451 | 3,371 | 4,092 | 5,944 | 6,419 | 7,369 |
| **D. Large** | 7,018 | 9,282 | 13,772 | 16,290 | 22,639 | 24,369 | 27,339 |
| **E. Viral** | 28,426 | 39,477 | 61,677 | 72,275 | 97,275 | 104,125 | 117,525 |

### Cost per MAU/month
| Tier | P1 | P3 | P5 | P7 |
|---|---:|---:|---:|---:|
| A (30) | $1.00 | $1.43 | $5.43 | $6.80 |
| B (500) | $0.65 | $1.01 | $2.02 | $2.63 |
| C (4K) | $0.49 | $0.84 | $1.49 | $1.84 |
| D (20K) | $0.35 | $0.69 | $1.13 | $1.37 |
| E (100K) | $0.28 | $0.62 | $0.97 | $1.18 |

**$/MAU is the metric to track.** Going from P1 to P7 roughly triples your per-MAU cost at every tier. That's the cost of adding payments, signatures, real-time, search, moderation.

---

## 6. The phase-level cost dynamics — what to internalize

**Phase 1 → 2 (~+20% cost):** Linear scaling on existing primitives. No drama.

**Phase 2 → 3 (~+30-50% cost):** Claude is the spike. Bid normalization is structured-extraction-heavy. **Build prompt caching + batch API before Phase 3** or LLM will dominate the bill.

**Phase 3 → 4 (~+15-25% cost):** DocuSign + PDF generation are new but predictable. Per-envelope pricing means revenue should scale with this line — no growth without contracts, no contracts without spend.

**Phase 4 → 5 (~+40-60% cost):** Biggest single jump. Real-time messaging, project management storage growth, notifications, queues. **Two leverage points:** (a) self-host WebSockets on the existing API service instead of Pusher to save $499/mo at Tier D, (b) keep notifications in-app first, only add SMS for critical events to control Twilio spend.

**Phase 5 → 6 (~+5-10% cost):** Mostly just more Stripe transactions and storage growth. Minor.

**Phase 6 → 7 (~+10-20% cost):** Search index + moderation. Defer search until you have ≥5K reviews — Postgres full-text is free and fine until then.

---

## 7. Revenue alignment — phases should pay for themselves

The bill above means nothing without revenue. Two monetization models change the math very differently:

### Model A — Transaction take rate (recommended for marketplaces)
Charge 3-5% of contracts brokered through the platform.
- Avg US home improvement project: $5K-30K
- At Tier C (4K MAU, ~400 contracts/mo at $15K avg, 4% take): **$240K/mo revenue**
- P7 cost at Tier C: $7,369/mo — **3% of revenue**
- This model scales beautifully — costs grow with MAU, revenue grows with deal volume × deal size.

### Model B — Subscription
Charge pros $50-200/mo for premium listings; homeowners free.
- At Tier C with 800 paying pros at $100/mo: **$80K/mo revenue**
- P7 cost: $7,369/mo — **9% of revenue**
- Still healthy but more sensitive to LLM/DocuSign growth.

### Model C — Lead fees
$10-50 per qualified lead delivered to pro.
- At Tier C with ~2,000 leads/mo at $25 avg: **$50K/mo revenue**
- P7 cost: 15% of revenue. Tighter margin.

**The cost structure favors Model A or A+B hybrid.** Phase 5 (where most of the cost is) is also where the platform actually facilitates the transaction — natural alignment.

---

## 8. Phasing recommendations — what to build vs buy

**Build in-house (don't pay vendors):**
- Real-time messaging (Socket.io on existing API container) — saves $499/mo at Tier D vs Pusher
- Search until ≥5K records (Postgres full-text)
- Bid comparison logic (Claude + structured outputs, no SaaS)
- Moderation Tier 1 (Claude + keyword block list)

**Buy (don't reinvent):**
- E-signature → DocuSign or [Dropbox Sign](https://www.hellosign.com/products/dropbox-sign) (legal validity, audit trail)
- Payments → Stripe Connect (regulatory + chargeback handling)
- SMS → Twilio (carrier deliverability)
- PDF generation → Puppeteer self-host first, switch to DocRaptor only if you spend > 4 hrs/mo on infra issues
- Photo/video moderation at scale → AWS Rekognition or [Hive](https://thehive.ai) (your model isn't going to beat theirs)

**Defer (don't build until forced):**
- Mobile app — start with PWA (already on the roadmap)
- BI / data warehouse — Postgres + Metabase ($0) covers 90% until ≥20K MAU
- Multi-region — single-region us-west works until you have international customers complaining about latency
- SOC 2 — only when enterprise / insurance customers ask in writing

---

## 9. The most important sentence in this document

**Phases 1-3 stay cheap; Phase 5 is where the bill explodes because real-time + payments + messaging + project management all land at once. Plan revenue to start flowing by Phase 4 (contracts) so it can fund Phase 5 (execution).**

If you launch all 7 phases at once without revenue, you'll be at $5K-20K/mo cloud spend before a single customer has paid you. Sequence carefully:

1. P1+P2: pilot, free to use, learn what scope/bid features actually matter
2. P3: introduce paid tier for pros to see comparisons (revenue starts)
3. P4: e-sign — take rate kicks in on every contract
4. P5: execution — revenue should now be >5x cloud spend
5. P6+P7: close + reviews — these polish the loop and feed P1 (good reviews → more searches)
