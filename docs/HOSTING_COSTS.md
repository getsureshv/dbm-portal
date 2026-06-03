# dbm-portal — Hosting & Operating Cost Model

**Date:** 2026-06-03
**Stack baseline:** Render (web + API + Postgres), Cloudflare R2 (object storage), Firebase Authentication, Anthropic Claude (LLM), GitHub (source).

All figures in USD per month, rounded to the nearest dollar at the totals. Pricing pulled from vendor pages on 2026-06-03 ([Render Pricing](https://render.com/pricing), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Firebase Pricing](https://firebase.google.com/pricing), [Render workspace plans 2026](https://render.com/docs/new-workspace-plans)).

---

## 1. Assumptions per customer tier

We model 4 tiers and a "what-if viral" tier. A "customer" = a homeowner project owner. Each customer's projects + uploads + AI scans drive usage.

| Tier | Total registered users | Monthly active (MAU) | Daily active (DAU) | Projects created/mo | Docs uploaded/mo (avg 4 per project) | AI scans/mo | Avg upload size | Active project storage churn |
|---|---|---|---|---|---|---|---|---|
| **A. Pilot** (today) | 50 | 30 | 5 | 20 | 80 | 80 | 5 MB | 0.4 GB/mo growth |
| **B. Small** | 1,000 | 500 | 80 | 300 | 1,200 | 1,200 | 5 MB | 6 GB/mo growth |
| **C. Medium** | 10,000 | 4,000 | 600 | 2,500 | 10,000 | 10,000 | 5 MB | 50 GB/mo growth |
| **D. Large** | 50,000 | 20,000 | 3,000 | 12,500 | 50,000 | 50,000 | 5 MB | 250 GB/mo growth |
| **E. Viral** | 250,000 | 100,000 | 15,000 | 60,000 | 240,000 | 240,000 | 5 MB | 1,200 GB/mo growth |

Notes:
- 5 MB avg blends PDFs (~2-10 MB) with images (~1-3 MB). DBM allows up to 25 MB docs / 5 MB images.
- "Scan" = one Claude vision call per uploaded doc. Some users will Re-scan, padded into the count.
- Web search + chat = additional Claude calls; modeled below as a per-MAU allowance.

---

## 2. Render compute (web + API + Postgres)

Source: [Render Pricing](https://render.com/pricing).

### Web service (Next.js)
| Tier | Plan | Spec | $/mo |
|---|---|---|---|
| A | Starter | 0.5 CPU / 512 MB | 7 |
| B | Standard | 1 CPU / 2 GB | 25 |
| C | Pro | 2 CPU / 4 GB ×2 | 170 |
| D | Pro Plus | 4 CPU / 8 GB ×3 | 525 |
| E | Pro Max | 4 CPU / 16 GB ×6 | 1,350 |

### API service (NestJS — heavier; does Claude calls, R2 signed URLs, Prisma queries)
| Tier | Plan | Spec | $/mo |
|---|---|---|---|
| A | Starter | 0.5 CPU / 512 MB | 7 |
| B | Standard | 1 CPU / 2 GB ×2 | 50 |
| C | Pro Plus | 4 CPU / 8 GB ×2 | 350 |
| D | Pro Max | 4 CPU / 16 GB ×4 | 900 |
| E | Pro Ultra | 8 CPU / 32 GB ×6 | 2,700 |

### Postgres
Render Postgres now bills compute + storage independently at $0.30/GB-month for storage. See [Flexible Plans for Render Postgres](https://render.com/docs/postgresql-refresh).

| Tier | Instance | Storage | Compute $/mo | Storage $/mo | Total $/mo |
|---|---|---|---|---|---|
| A | Basic-256mb | 10 GB | 6 | 3 | 9 |
| B | Basic-1gb | 50 GB | 19 | 15 | 34 |
| C | Basic-4gb | 250 GB | 75 | 75 | 150 |
| D | Pro-8gb | 1,000 GB | 100 | 300 | 400 |
| E | Pro-16gb (×1 with read replica = 2 instances) | 4,000 GB total | 400 | 1,200 | 1,600 |

### Workspace plan (org-wide flat fee)
Per [Render workspace plans 2026](https://render.com/docs/new-workspace-plans):

| Tier | Workspace plan | $/mo | Included bandwidth | Build minutes |
|---|---|---|---|---|
| A | Hobby | 0 | 5 GB | 500 |
| B | Pro | 25 | 25 GB | 1,000 |
| C | Pro | 25 | 25 GB | 1,000 |
| D | Pro | 25 | 25 GB | 1,000 |
| E | Scale | 499 | 1,000 GB | 5,000 |

### Render bandwidth (egress from web + API)
$0.15/GB over plan allowance per [Render Pricing](https://render.com/pricing). Rough page-weight + JSON: ~3 MB/MAU/day session of usage = ~90 MB/MAU/mo.

| Tier | Monthly egress | Included | Overage $/mo |
|---|---|---|---|
| A | 3 GB | 5 GB | 0 |
| B | 45 GB | 25 GB | 3 |
| C | 360 GB | 25 GB | 50 |
| D | 1,800 GB | 25 GB | 266 |
| E | 9,000 GB | 1,000 GB | 1,200 |

---

## 3. Cloudflare R2 object storage

Source: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/). Egress is **free** — the killer feature vs S3. We pay only storage + operations.

- Storage: $0.015/GB-month (first 10 GB free)
- Class A (writes): $4.50/M (1 M free)
- Class B (reads): $0.36/M (10 M free)

### Storage growth assumption
Cumulative storage 12 months in, assuming 10% of uploads get hard-deleted and the rest accumulate:

| Tier | Cumulative storage (yr 1) | Storage $/mo | Class A (writes) $/mo | Class B (reads) $/mo | Total $/mo |
|---|---|---|---|---|---|
| A | 5 GB | 0 (free) | 0 (free) | 0 (free) | 0 |
| B | 70 GB | 1 | 0 (free) | 0 (free) | 1 |
| C | 600 GB | 9 | 0 (free; 30 K writes) | 0 (free; 200 K reads) | 9 |
| D | 3,000 GB | 45 | 0 (free; 150 K writes) | 0 (free; 1 M reads) | 45 |
| E | 15,000 GB | 225 | 0 (free; 720 K writes) | 0 (free; 5 M reads) | 225 |

R2 is the cheapest part of the bill by a wide margin. Even at viral scale it's $225.

---

## 4. Anthropic Claude (the dominant variable cost)

Source: [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing). Repo currently pins `claude-sonnet-4-20250514`. Sonnet 4 line is **$3 in / $15 out per MTok**.

### Per-call token model

| Operation | Avg input tok | Avg output tok | $/call |
|---|---|---|---|
| **Doc AI Scan** (vision PDF, extract scope) | 15,000 | 2,000 | $0.075 |
| **Web search + summary** | 3,000 | 800 | $0.021 |
| **Chat message** | 4,000 | 600 | $0.021 |
| **Scope Architect** (deeper structured output) | 8,000 | 3,000 | $0.069 |

Per-MAU monthly behavior assumption:
- 4 AI scans / MAU / mo
- 3 chat messages / MAU / mo
- 1 Scope Architect / MAU / mo
- 2 web searches / MAU / mo
- → **~$0.45 of Claude / MAU / mo** at list rates

### Tier totals

| Tier | MAU | Claude $/mo (list) | With prompt caching (-30%) | With migration to Haiku 4.5 for scans (-65%) |
|---|---|---|---|---|
| A | 30 | 14 | 10 | 5 |
| B | 500 | 225 | 158 | 79 |
| C | 4,000 | 1,800 | 1,260 | 630 |
| D | 20,000 | 9,000 | 6,300 | 3,150 |
| E | 100,000 | 45,000 | 31,500 | 15,750 |

**This is the single line item to engineer against.** Three levers:
1. **Prompt caching** on system prompts → 30-40% reduction. Cheap to add.
2. **Switch doc-scan to Claude Haiku 4.5** ($1/$5) → another 60-70% on the largest call. Haiku 4.5 is strong enough for OCR + structured extraction.
3. **Batch API** ($1.50/$7.50, 50% off Sonnet) for non-interactive scans that can wait <24 h → another 50%.

Realistic combined optimization gets you ~$0.10-0.15 per MAU/mo instead of $0.45. **Build these in before scaling past Tier B.**

Heads up: the repo's pinned model `claude-sonnet-4-20250514` is now marked deprecated. Migration to Sonnet 4.5 or 4.6 is a 1-line change and prices are identical.

---

## 5. Firebase Authentication

Source: [Firebase Pricing](https://firebase.google.com/pricing). Auth is free up to 50 K MAU on **standard providers** (email/password, Google, Apple, anonymous). SMS/OTP is per-message at carrier rates if used.

| Tier | MAU | Auth $/mo | Note |
|---|---|---|---|
| A | 30 | 0 | Free tier |
| B | 500 | 0 | Free tier |
| C | 4,000 | 0 | Free tier |
| D | 20,000 | 0 | Free tier |
| E | 100,000 | 275 | 50 K free + 50 K × $0.0055 |

If you turn on phone OTP at scale, budget **$0.01-0.04 per SMS** in the US. 1 OTP per signup at Tier D = ~$200-800 one-off / mo.

---

## 6. Security & observability (non-vendor-included)

Items you do not have today but should have before going past pilot.

| Item | Purpose | Suggested tool | A | B | C | D | E |
|---|---|---|---|---|---|---|---|
| Error monitoring | Find production bugs fast | Sentry (free → $26 → $80) | 0 | 26 | 80 | 80 | 200 |
| Uptime / synthetic checks | Page when API down | UptimeRobot / Better Stack | 0 | 0 | 20 | 50 | 100 |
| Log aggregation beyond Render's | Search/alert on logs | Render Logs or Logtail | 0 | 0 | 50 | 150 | 400 |
| WAF / DDoS / bot mgmt | Stop credential stuffing, abuse | Cloudflare Pro / Business | 0 | 25 | 25 | 250 | 250 |
| Secrets management | Beyond Render env vars | Doppler / Infisical | 0 | 0 | 25 | 50 | 100 |
| Backup verification | Point-in-time restore drills | Render Postgres PITR (included on Pro+) | 0 | 0 | 0 | 0 | 0 |
| SOC 2 / audit prep (if B2B) | Compliance | Vanta / Drata | 0 | 0 | 0 | 0 | 800 |
| Penetration test (annual, amortized) | External security review | Boutique pentest firm | 0 | 0 | 200 | 500 | 1,500 |
| **Security subtotal** | | | **0** | **51** | **400** | **1,080** | **3,350** |

---

## 7. Incidentals

| Item | A | B | C | D | E |
|---|---|---|---|---|---|
| Domain + DNS + email forwarding | 2 | 2 | 2 | 2 | 2 |
| Email sending (Postmark / Resend transactional) | 0 | 10 | 30 | 100 | 400 |
| Status page (Atlassian / Better Stack) | 0 | 0 | 30 | 30 | 50 |
| Analytics (PostHog / Plausible) | 0 | 19 | 50 | 200 | 500 |
| Support helpdesk (Crisp / Intercom) | 0 | 25 | 75 | 250 | 800 |
| **Incidentals subtotal** | **2** | **56** | **187** | **582** | **1,752** |

---

## 8. Headcount support cost (often forgotten)

Hosting bills are the easy part. To **operate** the service you need humans on rotation. Loaded cost (salary + benefits + tools) in US-ish 2026 dollars; reduce ~50% if offshore.

| Tier | On-call eng | Support rep | DevOps/SRE | Loaded $/mo |
|---|---|---|---|---|
| A | Founder rotates | Founder | Founder | 0 (sweat equity) |
| B | 0.25 FTE | 0.25 FTE | 0.1 FTE | ~8,500 |
| C | 1 FTE | 1 FTE | 0.5 FTE | ~32,000 |
| D | 2 FTE | 3 FTE | 1 FTE | ~80,000 |
| E | 4 FTE | 8 FTE | 3 FTE | ~210,000 |

These dwarf the cloud bill at every tier B and above. Including or excluding them depends on whether you treat the question as "cloud spend" or "true cost to operate." I show monthly totals **both ways** in the summary.

---

## 9. Roll-up — monthly cloud + ops (excluding headcount)

| Line item | A. Pilot | B. Small | C. Medium | D. Large | E. Viral |
|---|---:|---:|---:|---:|---:|
| Render web | 7 | 25 | 170 | 525 | 1,350 |
| Render API | 7 | 50 | 350 | 900 | 2,700 |
| Render Postgres | 9 | 34 | 150 | 400 | 1,600 |
| Render workspace | 0 | 25 | 25 | 25 | 499 |
| Render bandwidth overage | 0 | 3 | 50 | 266 | 1,200 |
| Cloudflare R2 | 0 | 1 | 9 | 45 | 225 |
| Anthropic Claude (list) | 14 | 225 | 1,800 | 9,000 | 45,000 |
| Anthropic Claude (optimized) | 5 | 79 | 630 | 3,150 | 15,750 |
| Firebase Auth | 0 | 0 | 0 | 0 | 275 |
| Security & observability | 0 | 51 | 400 | 1,080 | 3,350 |
| Incidentals | 2 | 56 | 187 | 582 | 1,752 |
| **TOTAL — list LLM** | **39** | **470** | **3,141** | **12,823** | **57,951** |
| **TOTAL — optimized LLM** | **30** | **324** | **1,971** | **6,973** | **28,701** |
| + Headcount (loaded) | 0 | 8,500 | 32,000 | 80,000 | 210,000 |

### Cost per MAU (optimized LLM, ex-headcount)
| Tier | MAU | $/MAU/mo |
|---|---:|---:|
| A | 30 | $1.00 |
| B | 500 | $0.65 |
| C | 4,000 | $0.49 |
| D | 20,000 | $0.35 |
| E | 100,000 | $0.29 |

That's the unit economic to watch. If your monetization is $5-30/MAU/mo, gross margin on hosting + ops is healthy. If it's $0.50/MAU, the LLM bill alone breaks the model.

---

## 10. Recommendations to keep costs sane as you grow

1. **Optimize Claude first, before any infra upgrade.** Add prompt caching + move scans to Haiku 4.5 — that's a 65% cut on your biggest variable line item, achievable in one PR.
2. **Pin context windows.** Truncate documents to the first 30 K tokens before sending; pages beyond that rarely change scope-architect output.
3. **Use Anthropic Batch API for non-interactive scans.** If a user uploads at 11 PM and gets scan results by morning, that's fine — saves 50%.
4. **Keep R2 as primary blob store.** Egress-free saves serious money vs S3 starting at Tier C.
5. **Stay on Render Pro workspace plan ($25 flat) as long as possible** — it covers up to Tier D before you need Scale.
6. **Don't preemptively over-provision Postgres.** It's cheap to scale up storage and compute independently on Render's flexible plans now.
7. **Set hard usage limits per user.** A free-tier abuser running 1,000 scans/mo costs you $75 at list price. Add a rate limit (e.g. 20 scans/mo on free tier) before you advertise.
8. **Cache extracted scan text aggressively.** Re-scan is already noted as a footgun — make it explicit cost-per-rescan in the UI or gate it.
9. **Monitor cost-per-MAU as a north-star metric**, not absolute spend. Spend going up is fine; $/MAU going up is the alarm.
10. **Plan for SOC 2 only if you sell to businesses.** B2C homeowner marketplace doesn't need it; skipping saves $20-50K/yr.

---

## 11. Caveats and known unknowns

- **Bandwidth estimates** are rough — page weight is the single biggest variable. A 3 MB SPA is normal but heavy.
- **AI scan token counts** assume vision-mode PDFs at 5 MB. Larger blueprints can 2-3x that.
- **Spike costs**: Anthropic billing is real-time; a runaway loop could burn $1K in hours. Set spend alerts at Anthropic console.
- **Provider lock-in risk**: Render is a fine choice up to Tier D but at Tier E+ you may want to evaluate Fly.io or AWS/GCP/Cloudflare Workers for cost. Migration cost ≈ 4-8 engineer-weeks.
- **Postgres backups beyond Render's built-in PITR** (e.g. cross-region cold backups) not included; budget +$50-200/mo at Tier C+ if you need them.
