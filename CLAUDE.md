# DBM Construction Portal — Claude Code Instructions

## Project Overview

**What is DBM?**
- Full name: "Don't Build Meh" — a construction services portal
- Marketplace connecting **Owners** (clients needing construction work) with **Providers** (construction professionals, suppliers, freight companies)
- AI-first: The flagship feature is the **AI Scope Architect**, which interviews clients to generate professional Scope of Work (SOW) PDFs

**The 7-Phase Project Lifecycle** (what drives all UI/UX)
1. **Discovery** — Owner searches for and vets Providers
2. **Bidding** — Provider submits price quotes; Owner compares
3. **Finalization** — Negotiate scope, schedule, terms
4. **Contracting** — Legal documents signed
5. **Execution** — Work happens; invoicing, RFIs, change orders
6. **Closing** — Final payment, lien waivers, project handoff
7. **Archive** — Historic record; repeat work templates

**Phase 1 Scope** (what we're building now)
This sprint builds the foundation: authentication, user onboarding, project creation, AI Scope Architect, and discovery search.

**User Roles**
- **OWNER** — person or company seeking construction work. Creates projects, interviews AI, views bids, awards contracts.
- **PROVIDER** — professional, supplier, or freight company. Searches opportunities, submits bids, executes contracts.

Each Provider has a subtype with its own Prisma profile model: `ProfessionalProfile`, `SupplierProfile`, `FreightProfile`. Owners have a simple profile stored directly on the `User` model (name + phone fields).

---

## Current State (April 2026)

### What's Running
- ✅ **NestJS API** on `http://localhost:4000` — fully compiling, all routes mapped
- ✅ **Swagger docs** at `http://localhost:4000/api/docs`
- ✅ **Next.js web** on `http://localhost:3000` — all pages created with placeholder data
- ✅ **Docker** — PostgreSQL 16 + Redis + LocalStack S3 running via Docker Compose
- ✅ **Database schema** pushed to Postgres via `prisma db push`

### What's Built

**Infrastructure & Monorepo**
- ✅ pnpm workspaces configured
- ✅ Docker Compose: PostgreSQL 16 (no PostGIS — removed for ARM64 compatibility), LocalStack S3, Redis
- ✅ TypeScript strict mode throughout

**Database (Prisma)**
- ✅ Full schema with 20+ models (see `apps/api/prisma/schema.prisma`)
- ✅ User model with OWNER/PROVIDER/ADMIN roles
- ✅ Profile models: ProfessionalProfile, SupplierProfile, FreightProfile
- ✅ Projects, ScopeDocuments, ScopeInterviewTurns
- ✅ ChatConversations, ChatMessages
- ✅ TradeCategories, TradeNames (taxonomy)
- ✅ FeatureFlags for A/B testing
- ✅ Phase 5+ stubs (Invoice, ChangeOrder, Rfi, Submittal, DeliveryReport, ProgressReport)
- ✅ Schema pushed to Postgres (using `prisma db push`, NOT migrations)
- ⚠️ **Seed script has NOT run** — database is empty. Seed needs fixing (see Known Issues)

**Backend (NestJS) — All modules compile and load**
- ✅ **Auth module**: Firebase token verification (dev mode with mock tokens) → HTTP-only session cookies + Bearer tokens
- ✅ **Onboarding module**: role selection, profile creation (Owner: name+phone on User model; Provider: full profile)
- ✅ **Projects module**: CRUD endpoints, soft delete, document upload records
- ✅ **Discovery module**: vendor search by trade category and type
- ✅ **Uploads module**: S3 pre-signed URLs via LocalStack
- ✅ **Chat module**: SSE streaming endpoint `/chat/scope/:projectId` (requires ANTHROPIC_API_KEY)
- ✅ **Health controller**: `/health` and `/ready` endpoints
- ✅ Swagger UI at `/api/docs`
- ✅ PrismaModule is global (imported in AppModule, available everywhere — do NOT add PrismaService to individual module providers)

**Frontend (Next.js) — All pages created with placeholder data**
- ✅ Landing page (`/`) with role selection cards, social auth buttons
- ✅ Login page (`/login`) with email/password + Google/Apple auth
- ✅ Onboarding flow (`/onboarding?role=owner` or `?role=provider`) — multi-step
- ✅ Dashboard (`/dashboard`) with stats cards, recent projects, quick actions
- ✅ Projects list (`/projects`) with filterable grid
- ✅ Project detail (`/projects/[id]`) with tabs: Overview, Documents, Scope, Team
- ✅ AI Scope Architect (`/projects/[id]/scope`) with split-panel layout (60% SOW preview / 40% chat)
- ✅ Discovery search (`/discovery`) with filters and provider cards
- ✅ Auth layout with sidebar navigation (Dashboard, Projects, Discovery, Chat)
- ✅ Tailwind config with custom DBM colors (navy, gold)
- ⚠️ **Pages use placeholder data** — not yet wired to the API

### What's NOT Built Yet
- ❌ Frontend ↔ API integration (pages use placeholder/mock data)
- ❌ Firebase Auth client-side setup (buttons exist but aren't wired)
- ❌ Database seed data (trade categories, test users)
- ❌ SOW PDF generation endpoint
- ❌ Real AI Scope Architect interview flow (ANTHROPIC_API_KEY needed)
- ❌ Mobile app (Expo SDK 51 — not scaffolded)
- ❌ PostGIS proximity search (removed PostGIS for ARM64 compat)
- ❌ E2E tests

---

## Architecture

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Monorepo** | pnpm workspaces | `apps/web`, `apps/api`, `apps/mobile`, `packages/shared-types`, `packages/chat` |
| **Frontend** | Next.js 14 (App Router) | TypeScript strict, Tailwind CSS, Lucide icons |
| **Backend** | NestJS + Prisma 5.22.0 + PostgreSQL 16 | Binary engine type (required for ARM64 Windows) |
| **Database** | PostgreSQL 16 (plain, no PostGIS) | Schema pushed via `prisma db push` |
| **Authentication** | Firebase Auth + custom session | Google/Apple/email sign-in; dev mode uses mock tokens |
| **Storage** | AWS S3 (LocalStack for dev) | Pre-signed upload URLs |
| **AI** | Anthropic Claude API | Powers Scope Architect (gracefully disabled when key not set) |
| **Mobile** | Expo SDK 51 + React Native | Not yet scaffolded |
| **Docker** | Docker Compose | Postgres 16 Alpine, LocalStack, Redis |

### Directory Structure

```
dbm-portal/
├── apps/
│   ├── web/                          # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── login/page.tsx        # Login page
│   │   │   └── (auth)/              # Route group for authenticated pages
│   │   │       ├── layout.tsx        # Sidebar nav layout
│   │   │       ├── onboarding/page.tsx
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── discovery/page.tsx
│   │   │       └── projects/
│   │   │           ├── page.tsx      # Project list
│   │   │           └── [id]/
│   │   │               ├── page.tsx  # Project detail
│   │   │               └── scope/page.tsx  # AI Scope Architect
│   │   └── globals.css
│   ├── api/                          # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # DATABASE SOURCE OF TRUTH
│   │   │   └── seed/index.ts         # Seed script (needs fixing)
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── health.controller.ts
│   │   │   ├── common/
│   │   │   │   ├── prisma.module.ts  # GLOBAL — do not re-import
│   │   │   │   └── prisma.service.ts
│   │   │   └── modules/
│   │   │       ├── auth/             # Firebase verify + session cookies
│   │   │       ├── onboarding/       # Role + profile creation
│   │   │       ├── projects/         # CRUD + document uploads
│   │   │       ├── discovery/        # Provider search
│   │   │       ├── uploads/          # S3 pre-signed URLs
│   │   │       └── chat/             # AI Scope Architect SSE
│   │   └── .env                      # Environment variables
│   └── mobile/                       # Not yet scaffolded
├── packages/
│   ├── shared-types/                 # TypeScript interfaces & enums
│   └── chat/                         # Scope Architect interview logic
├── infra/
│   ├── docker-compose.yml            # Postgres, LocalStack, Redis
│   ├── init-db.sql                   # DB init script
│   └── init-s3.sh                    # S3 bucket creation
├── CLAUDE.md                         # THIS FILE
├── CLAUDE_CODE_REFERENCE.md          # Product strategy reference
└── PHASE1_CLAUDE_CODE_PLAN.md        # 12-week development plan
```

---

## Running Locally

### Prerequisites
- Node.js 22+ (ARM64 build if on Windows ARM)
- pnpm 10+
- Docker Desktop (with WSL 2 on Windows)

### Important: ARM64 Windows Notes
This project was developed on ARM64 Windows. Key compatibility notes:
- **Prisma engine**: Must use `engineType = "binary"` in schema.prisma (library mode crashes on ARM64 Windows)
- **PostGIS**: Removed — no ARM64 Docker image available. Use plain PostgreSQL 16.
- **Docker images**: Use `postgres:16-alpine` (not `postgis/postgis`)
- **Node.js**: Must be the ARM64 build (verify with `node -p "process.arch"` → should say `arm64`)

### First-Time Setup

```bash
# 1. Install dependencies
cd dbm-portal
pnpm install

# 2. Start Docker services
cd infra
docker compose up -d
# Starts: Postgres on :5432, LocalStack on :4566, Redis on :6379

# 3. Push database schema (NOT migrate — use db push)
cd ..
pnpm --filter @dbm/api exec prisma generate
pnpm --filter @dbm/api exec prisma db push

# 4. Seed database (if seed script is fixed)
pnpm --filter @dbm/api exec prisma db seed

# 5. Start development servers (in separate terminals)
# Terminal 1 — API:
pnpm --filter @dbm/api run dev
# Terminal 2 — Web:
pnpm --filter @dbm/web run dev

# 6. Verify
# Web:    http://localhost:3000
# API:    http://localhost:4000
# Swagger: http://localhost:4000/api/docs
```

### Environment Variables

Backend env file at `apps/api/.env`:

```bash
DATABASE_URL="postgresql://dbm:dbm_secret@localhost:5432/dbm_portal"
FIREBASE_PROJECT_ID="dbm-construction-dev"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@dbm-construction-dev.iam.gserviceaccount.com"
ANTHROPIC_API_KEY=""                    # Set to enable AI Scope Architect
AWS_S3_ENDPOINT="http://localhost:4566" # LocalStack
AWS_S3_REGION="us-east-1"
AWS_S3_ACCESS_KEY_ID="test"
AWS_S3_SECRET_ACCESS_KEY="test"
AWS_S3_BUCKET="dbm-uploads"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
```

---

## What Needs Building Next (Priority Order)

### 1. Fix Database Seed Script (BLOCKER)
**Status**: Seed script fails with Prisma engine error on ARM64
**File**: `apps/api/prisma/seed/index.ts`
**Work**:
- Verify seed script uses correct model names matching schema (ProfessionalProfile, SupplierProfile, etc.)
- Ensure field names match schema exactly (firebaseUid not uid, label not slug on TradeCategory)
- Test with `pnpm --filter @dbm/api exec prisma db seed`
- Must seed: TradeCategories (4), TradeNames (40+), test Users

### 2. Wire Frontend to API
**Status**: All pages exist with placeholder/mock data
**Work**:
- Create `apps/web/lib/api.ts` — typed API client with fetch wrapper
- Replace placeholder data in all pages with real API calls
- Handle auth state (store session, redirect unauthenticated users)
- Add loading states, error handling, empty states

### 3. Complete Authentication Flow
**Status**: Backend auth module works; frontend buttons are placeholders
**Work**:
- Set up Firebase SDK on frontend
- Wire Google + Apple sign-in buttons
- Handle token exchange with backend (`POST /auth/session`)
- Store session cookie; redirect to onboarding or dashboard
- Implement logout
- Dev mode: allow mock login without Firebase

### 4. AI Scope Architect Integration (HIGHEST IMPACT)
**Status**: Backend SSE endpoint exists; frontend split-panel UI exists with placeholder
**Work**:
- Set `ANTHROPIC_API_KEY` in `.env`
- Connect chat input to `POST /chat/scope/:projectId` SSE endpoint
- Parse streamed responses and update SOW preview in real-time
- Implement 4-turn interview flow (Core → Technicals → Why → Logistics)
- Update completeness bar based on filled ScopeDocument fields
- Store interview turns in ScopeInterviewTurn table

### 5. SOW PDF Generation
**Status**: Not implemented
**Work**:
- Create endpoint: `POST /projects/:id/scope/generate-pdf`
- Template with DBM branding (navy, gold)
- Sections: Scope, Deliverables, Exclusions, Timeline, Budget, Terms
- Store PDF in S3, return download URL
- Use Puppeteer or PDFKit

### 6. Expo Mobile App Scaffold
**Status**: Not created
**Work**:
- Initialize in `apps/mobile/`
- Expo SDK 51 + Expo Router
- Share `packages/shared-types`
- Screens: Auth, Dashboard, Discovery, Project detail, AI Scope Architect, Profile

---

## Critical Design Decisions (DO NOT Change Without Approval)

### User Model
- Two role types: **OWNER** (simple) and **PROVIDER** (complex, three subtypes: Professional, Supplier, Freight)
- No "Client" or "Professional" terms in UI — always say OWNER/PROVIDER
- OWNER onboarding must be **zero friction**: name + phone only
- Owner profile fields (name, phone) are stored directly on the `User` model — there is NO separate OwnerProfile table

### AI Scope Architect
- This is the **primary AI surface**, not a generic chatbot
- **Split-panel UX**: SOW live preview on left (60%), interview chat on right (40%)
- **4-turn interview** structure (Core, Technicals, Why, Logistics) — do not deviate
- Completeness bar unlocks PDF generation at 65%
- If ANTHROPIC_API_KEY is not set, the chat service logs a warning and returns 503 — does NOT crash the app

### Trade Taxonomy
- 4 categories: "Planning & Design", "Contractors", "Suppliers", "Services"
- Uses `TradeGroup` enum: `PLANNING_DESIGN`, `CONTRACTORS`, `SUPPLIERS`, `SERVICES`
- TradeCategory model has `name` (enum) and `label` (human-readable string)
- TradeName has `name`, `slug`, and references `categoryId`

### Prisma / Database
- **Use `prisma db push`** for schema changes (NOT `prisma migrate dev` — shadow database fails on ARM64)
- **PrismaModule is GLOBAL** — imported once in AppModule. Do NOT add PrismaService to individual module providers
- **Engine type is `binary`** — required for ARM64 Windows compatibility. Do not change to `library`
- IDs use Prisma's `@default(uuid())` — not `dbgenerated("uuid_generate_v4()")`
- No PostGIS extensions — removed for ARM64 compatibility. Geo features deferred.

### Authentication
- AuthModule exports AuthGuard
- All protected modules must `imports: [AuthModule]` to use the guard
- Auth supports both cookie-based sessions (web) and Bearer tokens (mobile)
- Dev mode: set `NODE_ENV=development` — uses mock token verification

---

## API Endpoints

All endpoints return JSON; errors include `statusCode` + `message`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/ready` | No | Readiness check |
| POST | `/auth/session` | Firebase token | Exchange Firebase token for session cookie |
| POST | `/auth/logout` | Session | Clear session |
| GET | `/auth/me` | Session | Get current user + profile |
| POST | `/onboarding/role` | Session | Set OWNER or PROVIDER role |
| POST | `/onboarding/profile` | Session | Create profile (role-specific) |
| GET | `/projects` | Session | List user's projects |
| POST | `/projects` | Session | Create project |
| GET | `/projects/:id` | Session | Get project detail |
| PATCH | `/projects/:id` | Session | Update project |
| DELETE | `/projects/:id` | Session | Soft delete project |
| POST | `/projects/:id/documents` | Session | Record document upload |
| GET | `/discovery/vendors` | Session | Search providers |
| POST | `/uploads/presign` | Session | Get pre-signed S3 URL |
| POST | `/chat/scope/:projectId` | Session | SSE streaming — AI Scope Architect |
| GET | `/chat/conversations` | Session | List conversations |
| GET | `/api/docs` | No | Swagger UI |

---

## Code Style & Conventions

### NestJS Backend
- One feature per module under `src/modules/`
- DTOs with `class-validator` decorators for input validation
- Guards for authentication (`@UseGuards(AuthGuard)`)
- Swagger decorators on all endpoints
- PrismaService injected from global PrismaModule — never add to module providers

### Next.js Frontend
- **App Router** only (no Pages Router)
- `(auth)` route group for authenticated pages with shared sidebar layout
- All pages currently use `'use client'` — can convert to Server Components where appropriate
- Tailwind CSS with custom colors: `navy`, `gold`, `navy-dark`, `navy-light`, `gold-dark`
- Lucide React for all icons

### Tailwind Custom Colors
```
navy: '#0B1D3A'
navy-dark: '#081529'
navy-light: '#122B52'
gold: '#D4A843'
gold-dark: '#B8922F'
```

---

## Known Issues

1. **Seed script crashes** on ARM64 Windows — Prisma binary engine may not work correctly with ts-node seed. Try running seed with `npx tsx` instead of `ts-node`.
2. **PostGIS removed** — no ARM64 Docker image. Geo/proximity features deferred to Phase 2 or when PostGIS ARM64 support is available.
3. **Firebase Auth is placeholder** — `.env` has dummy Firebase credentials. Replace with real Firebase project config for actual auth.
4. **ANTHROPIC_API_KEY empty** — AI chat features return 503 until a real key is set.
5. **Frontend uses placeholder data** — no API calls wired yet; all pages show mock/hardcoded content.
6. **No tests** — no unit or E2E tests exist yet.

---

## Reference Documents

Before making changes, read these in order:

1. **`CLAUDE_CODE_REFERENCE.md`** (project root) — Product strategy, NotebookLM design mandates, vendor evaluation, cost model
2. **`PHASE1_CLAUDE_CODE_PLAN.md`** (project root) — 12-week plan with 53 tasks, story points, dependencies
3. **`apps/api/prisma/schema.prisma`** — Source of truth for data model

---

**Last Updated**: April 11, 2026
**Phase**: 1 (Foundation)
**Status**: Full stack running locally — API compiled, all frontend pages created, database schema deployed. Next: wire frontend to API, fix seed, integrate auth.
