# DBM City Integration — 1-Week Demo Plan

**Start:** Thursday, June 4, 2026 (morning)
**Demo target:** Thursday, June 11, 2026
**Branch:** `feat/city-integration-demo` on `getsureshv/dbm-portal`
**Scope:** Dallas + Flower Mound, permits + code rules (60/40 weight), demo-grade
**Roles:** Suresh = human contact + vendor signups + PR review. Computer + agents = build.

---

## What this demo proves

A homeowner or pro types an address inside DBM Portal. The page returns:

1. **Permits on file** at that address (Dallas via Accela sandbox; Flower Mound via Shovels or mock)
2. **Relevant code rules** for the picked project scope (deck, ADU, kitchen remodel, etc.)
3. A "Verify with jurisdiction" disclaimer

That's enough to show investors, partners, or pilot users that DBM has the city-data angle covered. Production-grade comes later.

---

## What's IN the demo

- Branch: `feat/city-integration-demo`
- DB migration adding `Jurisdiction`, `Permit`, `CodeRule` (no Inspection yet)
- Hard-coded jurisdictions: Dallas (vendor=accela), Flower Mound (vendor=shovels OR mock)
- `JurisdictionAdapter` interface + 2 implementations (Accela, Shovels-or-mock)
- Address → jurisdiction resolver (zip-prefix lookup; not perfect, fine for demo)
- New page `/projects/[id]/jurisdiction` showing permits + code rules
- 2–3 hand-curated code rules per city for the demo scope (deck, ADU, kitchen remodel)
- "DEMO — data may be stale" banner
- README section + 5-min Loom recording for stakeholders

## What's OUT of the demo (deferred)

- ICC Code Connect API (contracting takes months → use scraped/curated rules)
- Houston (Wave 3 entirely)
- Permit filing / write path
- Inspection scheduling
- Admin / ops console
- Smoke tests + monitoring
- Full address normalization
- Mobile surfaces
- Production Accela OAuth (sandbox/citizen-read only)

---

## The agent team (5 agents, not 7)

| Agent | Charter | Days active |
|---|---|---|
| **Discovery Agent** | Confirm Accela sandbox endpoints, verify Shovels covers Flower Mound, pull Dallas + FM code amendments to disk | Thu (D1) |
| **Schema Agent** | Prisma migration: `Jurisdiction`, `Permit`, `CodeRule`. `JurisdictionAdapter` interface. PR. | Thu–Fri (D1–D2) |
| **Adapter Agent** | Build Accela adapter (Dallas) + Shovels adapter or mock (FM). Both implement the interface. PR. | Fri–Mon (D2–D5) |
| **Code/Rules Agent** | Curate 6–9 code rules total (3 per scope × 2 cities), seed into `CodeRule`. Build `/code/lookup` endpoint. PR. | Sat–Tue (D3–D6) |
| **UI Agent** | Build `/projects/[id]/jurisdiction` page: address input, permits table, rules panel, disclaimer banner. PR. | Mon–Wed (D5–D7) |

I (Computer) act as Orchestrator — sequence the agents, review their PRs, hand you decisions when needed.

---

## Day-by-day schedule

```
Day 1  Thu Jun 4   Discovery + Schema kick off. You hand me Accela + Shovels keys.
Day 2  Fri Jun 5   Schema PR merged. Adapter Agent starts. Code/Rules curation starts.
Day 3  Sat Jun 6   Adapter Agent: Accela sandbox calls working. Code rules loaded.
Day 4  Sun Jun 7   Adapter Agent: Shovels OR mock for FM done. UI Agent starts.
Day 5  Mon Jun 8   UI page renders permits. /code/lookup endpoint live.
Day 6  Tue Jun 9   UI shows rules. End-to-end working. Bug fix pass.
Day 7  Wed Jun 10  Polish, banner, Loom recording, README.
Day 8  Thu Jun 11  DEMO DAY. Show working flow on Render or local.
```

Every day at end-of-day I post a status summary so you can review and unblock.

---

## What I need from you BEFORE Thursday morning

Three things. The first two are 10 minutes each.

### 1. Accela Developer account (free, ~10 min)
1. Go to https://developer.accela.com
2. Sign up — use your getsureshv@gmail.com
3. Create an app → "Citizen" type → for "Dallas, TX" agency
4. Get the **App ID** and **App Secret**
5. Paste them into the chat. I'll save to env, never log.

### 2. Shovels.ai account (free trial, ~10 min)
1. Go to https://app.shovels.ai
2. Sign up — start the free trial (no card required for trial)
3. Generate an **API key** under settings
4. Paste it into the chat

### 3. Pick a demo project scope (1 min)
What's the example project scope we'll demo with? Pick one or suggest your own:
- "Add a deck to my house"
- "Build an accessory dwelling unit (ADU)"
- "Kitchen remodel — load-bearing wall removal"
- "Solar panel install"

The Code/Rules Agent will curate the 6–9 most relevant code rules around your pick.

---

## Daily check-in protocol

- **End of each day:** I post a status note here in chat — what shipped, what's blocked, what I need from you
- **Blockers from you:** I tag with `@suresh` so you know exactly what needs your call
- **PR review:** I'll ping you when a PR is ready. You skim, comment, approve. Each PR < 300 lines so review takes 10–15 min
- **Goal mode:** I'll create a goal `dbm-city-demo` so we both see the milestone — you can update goal mode from any device

---

## Cost reality

This is **demo-grade Wave 1+2 compressed**:

| Item | Hours | $ at solo rate |
|---|---|---|
| Discovery + Schema | 32 | $1,600 |
| Accela adapter (sandbox only) | 24 | $1,200 |
| Shovels adapter or mock | 16 | $800 |
| Code/Rules curated (no ICC) | 24 | $1,200 |
| UI page | 24 | $1,200 |
| Orchestration + your time | 16 | $800 |
| **Total** | **136** | **~$6,800** |
| Contingency 25% | | $1,700 |
| **All-in demo cost** | | **~$8,500** |

Compare to full Wave 1+2 production build: ~$52K. The demo is **~16% of that**. That's the price of compressing 19 weeks of work into 7 days with deferred items.

After the demo, if it lands, you have a clear path to v1 production: just unstub the deferred items (ICC, Houston, ops console, smoke tests, real OAuth) — that work is on top of the demo, not throwaway.

---

## Risks (one-week build)

| Risk | What I'll do |
|---|---|
| Accela sandbox is slow to activate (24–48 hr review) | If not live by Friday EOD, swap in a mock adapter for Dallas too. Demo still happens. |
| Shovels doesn't cover Flower Mound | Mock adapter for FM with realistic-looking seeded data. Disclose in demo. |
| You're slammed and can't review PRs same-day | Agents keep building; PRs queue up. You batch-review Saturday. |
| Render free tier hits the demo wall (cold starts) | Deploy demo on a dedicated free env or have local-dev fallback ready. |
| Anthropic API quota / cost spikes during build | Agents use Haiku for routine work, Sonnet only for hard parts. |

---

## What "done" looks like Thursday June 11

- [ ] You can hit `https://dbm-portal-web.onrender.com/demo/jurisdiction` (or local)
- [ ] Enter a Dallas address → see real permits from Accela sandbox + relevant code rules
- [ ] Enter a Flower Mound address → see permits (real or mock) + relevant code rules
- [ ] Page has the "DEMO" disclaimer banner
- [ ] 5-minute Loom recording walking through the flow exists
- [ ] PR is merged or ready-to-merge on `feat/city-integration-demo`
- [ ] You can confidently show this to one investor, one pilot user, or one partner
