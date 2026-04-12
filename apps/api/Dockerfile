FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all workspaces (needed for install)
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy API source
COPY apps/api/ apps/api/

# Generate Prisma client
RUN pnpm --filter @dbm/api exec prisma generate

# Build API
RUN pnpm --filter @dbm/api run build

# Production stage
FROM node:22-slim AS production
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "apps/api/dist/src/main.js"]
