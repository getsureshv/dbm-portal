#!/bin/sh
# Container entrypoint for the API. Runs migrations + seed + starts server,
# streaming all output to stdout/stderr so failures appear in service logs.
set -e

cd /app/apps/api

echo "[entrypoint] Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

# Seed is best-effort: if it fails (e.g. trade taxonomy already populated by a
# previous deploy and a constraint changed), don't block the API from starting.
# Re-run manually from Render Shell if needed: cd /app/apps/api && node_modules/.bin/prisma db seed
echo "[entrypoint] Running prisma db seed (best-effort)..."
if node_modules/.bin/prisma db seed; then
  echo "[entrypoint] Seed succeeded."
else
  echo "[entrypoint] WARN: Seed failed (exit $?). Continuing to start API. Re-run manually if needed." >&2
fi

echo "[entrypoint] Starting API..."
exec node dist/src/main.js
