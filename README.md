# DBM Construction Portal

A comprehensive construction project management and coordination platform connecting owners, contractors, suppliers, and service providers.

## Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9 or higher
- **Docker** (for local database)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dbm-portal
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up the database and start development**
   ```bash
   pnpm dev
   ```
   This command starts Docker containers, runs migrations, seeds the database, and launches all services.

4. **Open in your browser**
   - Web: http://localhost:3000
   - API: http://localhost:4000

## Development URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Web App** | http://localhost:3000 | Main UI |
| **API** | http://localhost:4000 | REST/GraphQL endpoints |
| **API Docs** | http://localhost:4000/api/docs | Swagger documentation |
| **DB Studio** | `npx prisma studio` | Visual database browser |

## Test Credentials

Use these accounts for local development (no password required in dev mode):

| Role | Email | Password |
|------|-------|----------|
| **Owner** | owner@test.com | — |
| **Provider** | pro@test.com | — |

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, TypeScript
- **Backend**: Node.js, Express/Fastify, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSockets
- **AI Features**: Claude API integration for scope creation
- **Containerization**: Docker & Docker Compose

## Documentation

- **AI-Assisted Development Guide**: See [CLAUDE.md](./CLAUDE.md)
- **Database Schema**: Run `npx prisma studio` to explore
- **API Documentation**: http://localhost:4000/api/docs (when running)

## Useful Commands

```bash
pnpm dev              # Start all services
pnpm build            # Build for production
pnpm test             # Run test suite
pnpm db:seed          # Manually seed the database
pnpm db:reset         # Reset database to clean state
pnpm db:studio        # Open Prisma Studio
```

## Project Structure

```
dbm-portal/
├── apps/
│   ├── web/           # Next.js frontend
│   └── api/           # Express/Fastify backend
├── packages/
│   ├── database/      # Prisma schema & migrations
│   └── types/         # Shared TypeScript types
└── docker-compose.yml
```
