# PulseSeat Preview Run Doc

## Prerequisites
- Node.js 20+, pnpm 9+
- Docker daemon running (for PostgreSQL + Redis containers)
  - NOTE: This machine has BOTH a native Windows PostgreSQL service AND Docker's
    Postgres. The Docker container is exposed on host port **5433** to avoid the
    port collision with the native instance on 5432. `.env` points at 5433.

## Reproduce artifacts
```bash
# 1. Start containers (compose maps postgres to host 5433)
docker compose up -d postgres redis

# 2. Push schema + seed (from repo root or prisma/)
cd prisma
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pulseseat?schema=public" ./node_modules/.bin/prisma db push --schema schema.prisma
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pulseseat?schema=public" ./node_modules/.bin/tsx seed.ts
# → 20 Indian events across 13 cities, 20 seat maps with VIP/PREMIUM/GENERAL tiers

# 3. Generate the Prisma client after any schema change (must run while API is stopped)
cd prisma
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pulseseat?schema=public" ./node_modules/.bin/prisma generate --schema schema.prisma
```

Demo credentials (seeded): `user@pulseseat.dev / user123`, `admin@pulseseat.dev / admin123`

## Start servers
```bash
# API (from apps/api; tsx watch loads ../../.env automatically)
cd apps/api && pnpm dev
# → http://localhost:3001

# Web (from apps/web)
cd apps/web && pnpm dev
# → http://localhost:3000
```

## Ports
| Service | Port |
|---------|------|
| Next.js frontend | 3000 |
| Fastify API | 3001 |
| PostgreSQL (Docker) | **5433** (host) → 5432 (container) |
| Redis | 6379 |

## Detach commands (Windows) — used by this workspace
- API: `D:\PulseSeat\.freebuff\start-api.ps1` (node + tsx cli.mjs watch `--env-file=../../.env src/server.ts`, logs to `.freebuff/api.log`)
- Web: `D:\PulseSeat\.freebuff\start-web.ps1` (node + next dev -p 3000, logs to the preview log file)
- Kill API: `D:\PulseSeat\.freebuff\kill-api.ps1` (kills whatever listens on 3001)

## Gotchas
- The native Windows Postgres still owns 5432 — never point `.env` back at 5432 or you
  will hit the stale dataset.
- Regenerating the Prisma client requires the API to be stopped (query engine DLL lock).
- Seeded password hashes must use the same HMAC-SHA256 salt as `apps/api` `hashPassword`,
  otherwise login returns 401 for all seeded users.

## Load-test launch mode (API)
During load tests the API is started with raised rate limits via `.freebuff/start-api-loadtest.ps1`
(RATE_LIMIT_* = 1000000, logs → `.freebuff/api-loadtest.log`). For normal demo use, restart the API
without that script (default 100 req/min per IP applies). See `PULSESEAT_LOAD_TEST_REPORT.md` and
`load-tests/README.md`. k6 lives at `tools/k6-v2.3.0-windows-amd64/k6.exe`.
