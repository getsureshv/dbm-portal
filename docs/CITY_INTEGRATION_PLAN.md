# DBM Portal — City Integration: Phased Build Plan (Dallas → Flower Mound → Houston)

**Status:** Plan (no code yet)
**Owner:** Suresh
**Date:** 2026-06-03
**v1 cities:** Dallas, Flower Mound, Houston
**Strategy:** Phased — ship one city, learn, ship the next. Easiest first.

---

## 1. Why phased (not all-3-at-once)

After researching each city, they sit on **three different permitting platforms**:

| City | Permit platform | Vendor | Public API? | Difficulty |
|---|---|---|---|---|
| **Dallas** | DallasNow (`aca-prod.accela.com/dallastx`) | Accela Civic Platform | **Yes** — Accela Construct API (OAuth2 JSON) | **Easy** |
| **Flower Mound** | `etrakit.flower-mound.com` | CentralSquare eTRAKiT | No public API | Medium |
| **Houston** | iPermits (ILMS) + ProjectDox + Public Works | Legacy in-house + Avolve | No public API; legacy ILMS portal | **Hard** |

If we build all three in parallel, the hardest one (Houston) will dictate the timeline and burn the most contingency. If we phase, Dallas funds learning that makes Flower Mound cheaper, and both inform Houston.

Also: **Shovels.ai's real jurisdictional coverage is ~10%** (their own June 2025 newsletter says so). The 85% number is *population coverage*. So Shovels is a useful accelerator *only where it actually covers our cities* — we verify per-city as the first step.

---

## 2. The three waves

### Wave 1 — Dallas (weeks 1–4)
**Why first:** Accela is the only one with a real public API. Get the whole adapter pattern right here, ship value, and prove the agent-team model.

**Deliverables**
- Internal data model + `JurisdictionAdapter` interface (used for all 3 cities)
- Accela Construct API adapter — `findPermitsByAddress`, `getPermit`, `listInspections` (read-only)
- Code-rules adapter v1 — Dallas building code amendments (2021 IBC/IRC + Dallas amendments) from ICC + UpCodes fallback
- DBM UI: permit panel on project page; "this address has open permits" warning
- Smoke test + ops console

**Risk:** lowest. Accela has docs, OAuth2, JSON, sandbox. Most of the cost here is architecture work that pays back across all cities.

### Wave 2 — Flower Mound (weeks 5–7)
**Why second:** smallest jurisdiction, well-run, eTRAKiT is the same vendor as several other DFW suburbs (Frisco, Allen, McKinney) — pattern reuse later.

**Deliverables**
- Shovels.ai adapter (if Shovels covers Flower Mound — verify in Discovery)
- If Shovels covers: ship in 2 weeks
- If not: eTRAKiT portal automation (Playwright) for permit lookup; ~3 weeks
- Local amendments for Town of Flower Mound

**Risk:** medium. Vendor lock-in by CentralSquare. Plan B (portal automation) is doable but maintenance-heavy.

### Wave 3 — Houston (weeks 8–13)
**Why last:** legacy ILMS + ProjectDox, no API, no zoning (different rules engine), Houston-specific code amendments. Hardest by every measure.

**Deliverables**
- Houston-specific adapter: ILMS portal automation OR Shovels (verify)
- Code-rules: 2021 IBC/IRC + Houston Construction Code amendments (Public Works)
- Houston has no zoning — UI must hide zoning fields when jurisdiction=Houston
- Ops console: Houston gets heavier manual-queue weight (more failures expected)

**Risk:** high. Houston ILMS is legacy; pages change without notice. Plan for ongoing portal-automation maintenance.

---

## 3. Architecture (same across all 3 waves)

```
DBM Portal (Next.js / NestJS / Postgres)
       │
       ▼
┌─────────────────────────┐
│  JurisdictionAdapter    │   ← one interface, three impls
│  - findPermitsByAddress │
│  - getPermit            │
│  - listInspections      │
│  - getCodeRule          │
└──────┬────────┬─────────┘
       │        │
   ┌───▼───┐ ┌──▼────────┐
   │ Accela│ │  Shovels  │  ← used when it covers the city
   │ (Dal) │ │  fallback │
   └───────┘ └───────────┘
       │
   ┌───▼─────────────┐
   │ Portal Automation│  ← Flower Mound eTRAKiT, Houston ILMS
   │ (Playwright)     │
   └──────────────────┘
       │
   ┌───▼─────────┐
   │ Manual Queue│  ← always the last fallback
   └─────────────┘
```

Normalized DB:

```
Jurisdiction(id, name, state, fips, vendor, adapter_config jsonb)
Permit(id, jurisdiction_id, external_id, address, type, status,
       issued_at, finalized_at, contractor_name, valuation, raw jsonb)
Inspection(id, permit_id, type, scheduled_at, result, inspector)
CodeRule(id, jurisdiction_id, code_family, section, title, body,
         effective_date, source_url)
AddressLookup(address, jurisdiction_id, last_synced_at, ttl)
```

---

## 4. The agent team (same agents work all 3 waves)

| Agent | Wave 1 hours | Wave 2 hours | Wave 3 hours |
|---|---|---|---|
| **Orchestrator (you)** — spec, PR review, vendor convos | 32 | 16 | 24 |
| **Discovery Agent** — vendor, endpoints, code amendments per city | 32 | 24 | 40 |
| **Schema Agent** — internal model + adapter interface (run once, wave 1) | 56 | 0 | 0 |
| **Adapter Agent** — city-specific data adapter | 96 (Accela) | 64 (Shovels or eTRAKiT) | 120 (ILMS portal) |
| **Code/Rules Agent** — ICC + city amendments | 80 (sets framework) | 32 (delta) | 48 (Houston amendments) |
| **QA & Smoke Agent** — per-city smoke + alerts | 24 | 16 | 24 |
| **Ops Console Agent** — admin UI (wave 1 builds it; later waves extend) | 48 | 8 | 12 |
| **Wave subtotal (hours)** | **368** | **160** | **268** |

**Total v1 build: ~796 engineering hours** across all three cities.

Notice how Wave 2 and Wave 3 are much cheaper than they'd be standalone — the schema, code framework, and ops console are amortized from Wave 1. This is the whole reason to phase.

---

## 5. Sequencing (calendar)

```
Week  1   2   3   4   5   6   7   8   9   10  11  12  13
       ├───── Wave 1 ─────┤
       │   Dallas         │
       │ schema + Accela  │   ├── Wave 2 ──┤
       │ + code framework │   │ Flower Mound │
       │ + ops console    │   │ (Shovels or  │
                              │  eTRAKiT)    │
                                              ├──── Wave 3 ────┤
                                              │   Houston      │
                                              │ ILMS portal +  │
                                              │ amendments     │
```

**Pilot launch checkpoints**
- **Week 4:** Dallas alpha — 1 friendly homeowner + 1 friendly pro test it
- **Week 7:** Flower Mound alpha — same
- **Week 13:** Houston alpha — same
- **Week 14:** all-three v1 public launch

---

## 6. What I need from you before each wave

### Before Wave 1 (Dallas)
1. **Accela Developer account** — free signup at developer.accela.com → OAuth client ID/secret
2. **Shovels.ai trial** — $0 trial, then $599/mo if it covers Flower Mound/Houston (decided after Discovery)
3. **ICC Code Connect conversation** — open the contracting talk now; can take 2+ months
4. **2 friendly Dallas users** — 1 homeowner + 1 pro

### Before Wave 2 (Flower Mound)
1. Decision based on Discovery: Shovels-only vs. eTRAKiT portal automation
2. **2 friendly Flower Mound users**

### Before Wave 3 (Houston)
1. Decision: ILMS portal automation vs. Shovels-only vs. wait-for-Houston-CCM-API
2. **2 friendly Houston users**
3. Buffer in vendor budget for ILMS reliability (heavier manual-queue load)

---

## 7. Risks & mitigations

| Risk | Wave | Mitigation |
|---|---|---|
| Accela rate limits / OAuth quirks | 1 | Caching, exponential backoff, sandbox testing first |
| ICC contracting slow | All | UpCodes scrape as v1 fallback; pursue ICC partnership in parallel for v2 |
| Shovels doesn't cover Flower Mound or Houston | 2, 3 | Discovery verifies before commit; Plan B = portal automation |
| eTRAKiT HTML changes break automation | 2 | Smoke Agent catches within 24 hrs; manual queue absorbs |
| Houston ILMS is legacy and brittle | 3 | Higher contingency baked into Wave 3 (40% vs 25%); plan for monthly maintenance |
| Liability — DBM shows wrong code rule | All | UI disclaimer "informational only — verify with jurisdiction"; no auto-block in v1 |
| Houston has no zoning, UI assumes it | 3 | Jurisdiction config flag `has_zoning: false` honored by UI; tested in wave 1 |

---

## 8. What's out of v1 (explicit non-goals)

- **Electronic permit filing** (write path) — read-only first
- **Inspection scheduling** — read-only first
- **Cities beyond DFW + Houston** — playbook proven on these three; expansion is v2+
- **Mobile-app surfaces** — web first, mobile reads same APIs in v2
- **SOC 2 / heavy compliance** — required before any vendor data partnership; not at v1 traffic
- **Real-time push** — no US permit system pushes; polling is fine

---

## 9. Scale-out math (after v1 framework is built)

Once Wave 1 is done, the marginal cost per *additional* city collapses:

| Tier | Hours per added city | Why |
|---|---|---|
| Same vendor as a wave-1 city (Accela / eTRAKiT / ILMS) | 16–40 | Adapter exists; config + smoke only |
| New vendor we haven't seen | 60–120 | New adapter, new portal flow |
| Tyler EnerGov / Civic Access (Coppell, etc.) | 80–120 | Needs vendor data agreement |

DFW expansion order after v1 is obvious: **Plano, Frisco, Allen, McKinney** (all eTRAKiT or close) followed by **Fort Worth, Arlington** (Accela). Each one is ~$2–3K of marginal build at solo rate.

---

## 10. Hand-off to the cost sheet

See `DBM_City_Integration_Cost.xlsx`. Sheets:
- **Summary** — cost per wave + total + 4 rate scenarios
- **Wave Hours** — agent × wave hour grid
- **Rates** — blended rates, multipliers, vendor opex, hard costs
