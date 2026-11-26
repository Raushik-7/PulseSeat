# Redis Usage Audit — PulseSeat API

**Scope:** every Redis client, queue, worker, timer, middleware and cache path in
this repository.
**Outcome:** the API no longer issues a single Redis command while idle, Redis is
an optional dependency with a circuit breaker, and background email delivery
moved to PostgreSQL.

---

## 1. Executive summary

| Finding | Evidence | Status |
|---|---|---|
| A BullMQ `Worker` started inside the API process and polled Redis **24/7 with an empty queue** | `apps/api/src/server.ts` → `startEmailWorker()`; `bullmq@5.81.3` `worker.js:447` (`bzpopmin`) + `moveToActive` EVALSHA per poll | **Fixed** — worker removed, emails moved to a Postgres outbox |
| One idle worker burned **~35k commands/day** (~1M/month) — more than the entire 500k free quota | `blockTimeout = max(drainDelay(5s), minimumBlockTimeout)` → 12 polls/min × (1 BZPOPMIN + 1 EVALSHA); measured BZPOPMIN≈9.4k/interval and EVALSHA≈11k/interval is the same 1:1 signature | **Fixed** — idle Redis cost is now 0 |
| 4 Redis connections for 1 logical use (cache + 2 queues + worker), all created at module import | `plugins/redis.ts` (`getBullMQConnection` ×3), `email.worker.ts` | **Fixed** — one shared client |
| Event-list version bump was a read-modify-write (`GET` + `SET`) on every booking/cancel/admin mutation | `modules/events/events.cache.ts` | **Fixed** — one `INCR` |
| Every event-list request paid 2 Redis commands (version + payload) | `modules/events/events.routes.ts` | **Reduced** — version memoised in-process for 5s |
| Auth token storage called ioredis directly: no command timeout, no breaker, could hang a signup/reset on a half-dead socket | `modules/auth/auth.routes.ts` (6 direct `getRedis()` call sites) | **Fixed** — routed through `redis-safe` + Postgres fallbacks |
| Verification tokens written to Redis but the Postgres fallback was **never read** on verify | `auth.routes.ts` resend fallback vs verify-email | **Fixed** |
| Maintenance loop used a *session* advisory lock across pooled connections (lock could stick forever and silently stop the loop) and ran N+1 queries per expired booking | `maintenance.ts` | **Fixed** |
| Dead `hydrateLegacyRedisMetrics` bridge (a Redis `GET` loop on a metrics path) | `plugins/booking-metrics.ts` | **Removed** |
| `/health/deps` returned **503 when Redis was down** and sent 2 PINGs | `modules/health/health.routes.ts` | **Fixed** — 1 breaker-aware PING, Postgres decides the status code |

Already safe before this audit (verified, left alone):

- `@fastify/rate-limit` is configured **without** a Redis store → in-process
  buckets, **zero** Redis commands. (README claimed otherwise; corrected.)
- No `QueueEvents`, `QueueScheduler`, `FlowProducer`, repeatable/cron jobs, or
  delayed-job schedulers exist anywhere in the repo.
- `/health` and `/health/ready` already used no Redis, so the 13-minute external
  keep-alive costs 0 commands. That was verified by reading the route handlers,
  not assumed.
- Booking idempotency, booking metrics and audit logs are Postgres-backed.
- No Redis locks or Lua scripts guard seat allocation: correctness comes from
  `SELECT ... FOR UPDATE` in Postgres, so a Redis outage cannot double-book.

---

## 2. Redis inventory (after this change)

| Component | File | Purpose | Connection | Failure behaviour |
|---|---|---|---|---|
| Shared client | `apps/api/src/plugins/redis.ts` | single `ioredis` client for cache + auth tokens | 1, TLS auto for `rediss://` | never blocks boot; bounded reconnect; re-created on demand after cooldown |
| Safety layer / breaker | `apps/api/src/plugins/redis-safe.ts` | all commands | reuses shared client | fail-fast + breaker + Postgres fallback |
| Event list cache | `modules/events/*` | 60s listing cache + epoch invalidation | shared | serve Postgres |
| Event detail / availability / id-resolve cache | `modules/events/events.routes.ts`, `modules/seats/seats.routes.ts` | 10–60s caches, negative caching for bogus slugs | shared | serve Postgres |
| Auth tokens | `modules/auth/auth.routes.ts` | hashed verify/reset tokens, anti-spam guard | shared | Postgres fallback columns |
| Health | `modules/health/health.routes.ts` | 1 PING in `/health/deps` only | shared | reports `degraded`, still HTTP 200 |

Removed: BullMQ `Queue`/`Worker` (and the dependency), the unused
`notificationQueue`, `getBullMQConnection()`, `closeQueues()`, `hydrateLegacyRedisMetrics()`.

Booking emails are now rows in `email_outbox` (`prisma/schema.prisma`), claimed
with `FOR UPDATE SKIP LOCKED` by the maintenance loop
(`modules/email/email.outbox.ts`, `maintenance.ts`).

---

## 3. Why `BZPOPMIN` and `EVALSHA` were so frequent

`BZPOPMIN` is not used by application code. It is BullMQ's idle wait: a `Worker`
blocks on the queue's `marker` zset with `BZPOPMIN key <blockTimeout>`. With
BullMQ's default `drainDelay: 5` and no delayed jobs,
`getBlockTimeout()` returns `max(drainDelay, minimumBlockTimeout)` = **5 s**
(`bullmq/dist/cjs/classes/worker.js:490-512`). Each time that call returns, the
worker calls `moveToActive` — a Lua script invoked as `EVALSHA`.

So an **empty** queue costs, per worker, per 5 seconds:

```
1 × BZPOPMIN  +  1 × EVALSHA   →  12/min  →  720/hour  →  ~17,300/day each
                                                  ~34,600 commands/day total
```

That matches your dashboard: `BZPOPMIN ≈ 9,400` and `EVALSHA ≈ 11,000` in the
same interval (roughly 1:1, EVALSHA slightly ahead because failed/promotion
paths re-run the script). At 0.2 polls/second, 9,400 polls ≈ **13 hours of one
idle worker** — i.e. the reported interval is showing "one worker, running
continuously", not user traffic. With a monthly allowance of 500k
(≈16,600/day), the idle worker alone exceeds the quota in about two weeks; any
redeploy or extra instance multiplies it. That is the 3–4 day exhaustion.

`queue.concurrency` was 5, which does not multiply idle polls (BullMQ serialises
the first fetch and then blocks) but does multiply burst processing; it no longer
exists.

Why not "just tune `drainDelay`"? Setting it to, say, 60s reduces idle commands
to ~2,900/day but delays every email by up to a minute and still pays for a
broker we do not need. Booking email volume is a handful per day, so the outbox
is strictly better: 0 idle commands, no second datastore, same at-least-once
delivery.

### The read/write 1:1 ratio

Every cache read that misses also writes (`GET` → query → `SETEX`), and
invalidations are `DEL`s. The event-list path additionally did `GET version`
before `GET payload`, and every mutation did `GET version` + `SET version`.
Combined with BullMQ's scripted state transitions (each a write), that produces
the near-1:1 read/write split you saw. Removing the worker and collapsing the
version bump removes both halves of that ratio.

---

## 4. Command budget model

Measured (from your Upstash metrics, quoted): 250k reads, 250k writes per
month-ish window; `EVALSHA ≈ 11k`, `BZPOPMIN ≈ 9.4k` per interval.

Estimated per component (arithmetic above; not instrumented in this repo):

| Source | Before | After |
|---|---|---|
| Idle BullMQ worker | ~34.6k/day per instance, 24/7 | **0** |
| Cache read (list/detail/availability) | 1 GET (+1 GET version on list) | 1 GET (version memoised ≥5s) |
| Cache miss write | 1 SETEX | 1 SETEX |
| Booking/cancel/admin mutation invalidation | 2 DEL + (GET+SET version) = 4 | 2 DEL + 1 INCR = 3 |
| Email job lifecycle | ~10–15 commands per email (add, move, lock, complete, cleanup) + idle polling | 2 Postgres statements per email, 0 Redis |
| `/health`, `/health/ready`, keep-alive | 0 | 0 |
| `/health/deps` | 2 PINGs (1 pipelined) + 503 on Redis failure | 1 PING, skipped while breaker open |
| Rate limiting | 0 (in-process) | 0 |

The remaining Redis traffic is proportional to user requests only. Rough
expectation: with the worker gone, a quiet month should cost a few thousand
commands instead of 500k.

---

## 5. Resilience design

`plugins/redis-safe.ts` enforces, for **every** Redis call:

1. **Skip when not connected.** If the client is not `ready`, no command is
   issued and the caller gets "no cache" immediately. This removes the
   `enableOfflineQueue` hang class entirely (`enableOfflineQueue: false` on the
   client too).
2. **Fail fast.** `commandTimeout: 1500ms`, `connectTimeout: 3000ms`, one
   in-client retry (`maxRetriesPerRequest: 1`).
3. **Circuit breaker.** 3 consecutive failures → **open for 30s**
   (`REDIS_BREAKER_COOLDOWN_MS`): zero commands are sent, cache calls return
   `undefined` instantly, `/health/deps` reports `degraded` with
   `circuit: open`. After the cooldown exactly **one** probe is allowed
   (half-open); success closes the breaker, failure restarts the cooldown.
   Transitions are logged, not every error.
4. **Bounded reconnect.** `retryStrategy` backs off to 5s and stops after
   `REDIS_MAX_RECONNECT_ATTEMPTS` (8) instead of retrying forever; the next call
   after `REDIS_RECONNECT_COOLDOWN_MS` (60s) re-creates the client.
5. **Provider independence.** Only `REDIS_URL` is read (`rediss://` ⇒ TLS via
   ioredis). `REDIS_ENABLED=false` disables Redis with no code change. Commands
   used: `GET`, `SETEX`, `DEL`, `INCR`, `PING` — no Lua, no provider REST API, no
   vendor SDK.

### Feature-by-feature fallback policy

| Feature | Redis down | Correctness impact |
|---|---|---|
| Event list / detail / availability / id-resolve caches | Read from Postgres; writes are skipped | None (cache only) |
| Cache invalidation on booking/cancel | Skipped; keys carry short TTLs (10–60s) | Bounded staleness ≤60s, never incorrect data (Postgres is authoritative) |
| Seat reservation / booking | **Unaffected** — no Redis in the path; Postgres `SELECT … FOR UPDATE` | None. Redis failure can never make a seat look free or confirm an unsafe booking |
| Auth: email verification / password reset tokens | Stored in `users.reset_token_hash` / `reset_token_expires_at`; verify/reset read both | Users can still verify/reset during a Redis outage |
| Auth anti-spam guard (`verify/reset:ratelimit`) | Skipped (degraded) | HTTP-level per-route rate limits still apply; documented limitation |
| JWT auth | Unaffected (stateless HMAC) | None |
| Rate limiting | Unaffected (in-process) | Already per-instance, not distributed |
| Booking emails | Outbox row inserted; delivered by maintenance loop | None (durable, retried) |
| Email insert fails (Postgres problem) | Direct best-effort send, failure logged loudly | No silent "queued" claim |
| `/health`, `/health/ready` | Unaffected (no Redis) | Keep-alive never burns quota |
| `/health/deps` | `degraded`, HTTP stays 200 if Postgres is healthy | Monitoring no longer pages on an optional cache |

---

## 6. Migration guide (Upstash → anything)

1. Create the new database and copy its TLS URL.
2. Set `REDIS_URL=rediss://…` in the API environment. Nothing else.
3. Optionally set `REDIS_ENABLED=false` first, deploy, confirm the API is fully
   functional uncached, then switch the URL over.
4. No data migration is required: every key is a disposable cache or a
   TTL-bounded token (users can re-request a link). No BullMQ keys exist any
   more, so there is no queue state to drain.
5. If the provider is **Redis Cluster**, note that `cacheDel(...keys)` sends one
   multi-key `DEL`; with keys in different hash slots that returns a CROSSSLOT
   error, which the breaker absorbs (it degrades caching). Use a non-cluster
   endpoint, or change `cacheDel` to delete per key, if you move to cluster mode.

Configured by: `REDIS_URL`, `REDIS_ENABLED`, `REDIS_CONNECT_TIMEOUT_MS`,
`REDIS_COMMAND_TIMEOUT_MS`, `REDIS_MAX_RECONNECT_ATTEMPTS`,
`REDIS_RECONNECT_COOLDOWN_MS`, `REDIS_BREAKER_COOLDOWN_MS` (see `.env.example`).

---

## 7. Verification performed

Requires no external services:

```bash
pnpm --filter api typecheck      # tsc --noEmit → clean
pnpm --filter web typecheck      # tsc --noEmit → clean (admin status page change)
pnpm --filter api build          # tsc + esbuild bundle → clean
pnpm --filter api check:redis    # resilience scenarios → all pass
```

`check:redis` (`apps/api/scripts/check-redis-resilience.ts`) runs three
sub-processes against a fake RESP server and asserts:

- `REDIS_ENABLED=false` → no client is created, cache calls are no-ops, ~0ms.
- Unreachable Redis → 10 concurrent cache calls return immediately, never throw.
- Connected server answering `-ERR max requests limit exceeded` (the Upstash
  quota error) → at most 3 commands are sent, the breaker opens, then **20
  further cache calls and a health PING send zero commands**; after the
  cooldown exactly **one** probe is sent, the breaker closes and normal caching
  resumes.
- The built bundle contains **no** `bullmq`/`BZPOPMIN` references.

Also applied: Prisma client regenerated; `prisma validate` passes; the new
migration is `prisma/migrations/20261125000000_email_outbox`.

**Not verified here (no local Postgres/Redis; Docker daemon not running):** the
migration was not applied to a live database, and no end-to-end booking flow was
exercised. Before deploying:

```bash
pnpm --filter @pulseseat/prisma migrate deploy
# then, against the deployed API:
curl -s $API/health/deps          # postgres healthy, redis ok|degraded, emailOutbox counts
```

In Upstash, after deploy, the idle baseline should go to **zero commands** while
no one uses the app (check the "Commands" graph with no traffic), and
`BZPOPMIN`/`EVALSHA` should disappear from the command breakdown entirely.
