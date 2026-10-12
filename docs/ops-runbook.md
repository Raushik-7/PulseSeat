# PulseSeat — Ops Runbook

Practical, incident-first runbook for the deployed stack (Vercel → Render API → Supabase Postgres + Upstash Redis).
Last reviewed: 2026-10-12 (after the "event cards disappeared" incident).

## Architecture in one line

```
Browser (Vercel) ──HTTPS──▶ Render API (Fastify) ─┬─▶ Supabase Postgres  ← source of truth
                                                  └─▶ Upstash Redis     ← optional cache only
```

**Key design fact:** Redis is an *optimization*, never a dependency. Every public
read (events list, event detail, seats, availability) falls back to Postgres
within its request if Redis is dead (`apps/api/src/plugins/redis-safe.ts`).
A Redis outage slows + uncaches the site; it no longer blanks it.

## Symptom → most likely cause (check in this order)

| Symptom | Likely cause | Fastest check |
|---|---|---|
| Cards missing, `/health/ready` **200** | Frontend got an error and is showing the stale-banner... or Upstash quota exit | curl events endpoint (below); check Upstash usage page |
| Cards missing, `/health/ready` **503** | Postgres unreachable — Supabase **paused** (free tier, ~7d inactivity) or network | Supabase dashboard status; restore Resume |
| Cards missing, API **5xx on events, healthy /health** | Historical (pre-2026-10-12) Redis-coupled event path — fixed; redeploy latest API | Verify deployed image is post-fix |
| Cards missing, API **200 but empty list** | Query filter (seeded data actually gone?) — check `events` table | Supabase Table Editor → rows |
| Intermittent 429s | Rate limiter doing its job (bots/monitoring) — inspect which route | API logs, `route` field on request lines |
| Everything down, Render shows failed deploy | Build failure — see deploy notes in deployment docs (pnpm, `pgbouncer=true` DB URL) | Render Deploys → logs |

## One-liner health probes (from any machine)

```bash
curl -s https://pulseseat-api.onrender.com/health/live      # process alive (no deps)
curl -s https://pulseseat-api.onrender.com/health/ready     # Postgres reachable + servable
curl -s https://pulseseat-api.onrender.com/health/deps      # postgres + redis detail (use sparingly)
curl -s "https://pulseseat-api.onrender.com/api/v1/events?limit=3" | head -c 300
```

`/health/ready` costs **zero Redis commands** by design — safe for aggressive
external probes without burning Upstash quota (this was a real failure mode:
the old readiness check PINGed Redis per probe, contributing to quota exhaustion).

## The three outages to know

1. **Upstash free tier → 0 commands left.** Redis 401s/dies. Post-fix impact:
   first ~2 requests per endpoint uncached (direct Postgres), then the cache
   layer enters a 30s degraded window and stops trying. **Action:** wait for
   the monthly reset or upgrade; do NOT restart Render repeatedly (does nothing).
2. **Supabase paused.** Postgres unreachable entirely. `/health/ready` → 503.
   Everything dark including new bookings. **Action:** Supabase Dashboard →
   Resume the project (takes ~1 min). Consider a free cron ping to prevent.
3. **Render instance sleeping / cold start.** First request after ~15 min idle
   takes 30–60s. Frontend shows skeleton, then loads. Not a bug; fix = paid tier
   or a keep-alive ping (costs nothing against the new health endpoints).

## What "Redis degraded" looks like in logs

```
Redis unavailable — serving reads directly from Postgres (degraded cache mode) for 30s
```
Logged at most once per 30s outage window. If you see it repeatedly, Redis is
dead mid-flight; check Upstash usage/network. If silent: Redis is fine.

## Rate limits (defaults — document, don't redis-cover)

- General: 100/min per IP (env `RATE_LIMIT_*` configurable) — in-memory, NOT Redis
- login 10/min · signup 5/min · resend-verification 3/min · forgot-password 3/min · reset-password 10/min · POST /bookings 20/min
- 429 responses include `Retry-After`; cache-layer failures never trigger 429.

## Booking integrity under outages

- Seat conflict = Postgres row locks (`SELECT FOR UPDATE`), untouched by Redis.
- Idempotency (`Idempotency-Key` header) stored in **Postgres** (`idempotency_keys`).
  Verified: replay with the same key after a Redis outage returns the ORIGINAL
  booking instead of double-booking.
- Metrics counters live in Postgres (`metric_counters`) — `/metrics` costs 0 Redis cmds.

## Changes to production env vars (Render) — do these once

- `DATABASE_URL`: ...`pooler.supabase.com:6543/postgres?pgbouncer=true` (the
  `?pgbouncer=true` suffix prevents `prepared statement does not exist` 500s)
- `DIRECT_URL`: direct DB URL (for any manual migration runs) — only used by CLI

## Re-checking data is intact (read-only)

```bash
cd prisma
$env:DATABASE_URL = "<pooled url with ?pgbouncer=true>"
pnpm validate:images:db     # prints event/seat/image counts straight from Supabase
```
