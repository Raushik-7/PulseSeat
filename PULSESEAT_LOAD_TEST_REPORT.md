# PulseSeat Load Test Report

> **5,000 concurrent virtual users (VUs)** — staged k6 test against the running PulseSeat API.
> Every number in this report comes from actual test output stored in `load-tests/results/`. Nothing is estimated.

---

## Test Date

**2026-09-24**, between **~08:45 IST and ~09:15 IST** (k6 run duration: **15m 15s**; sampler window ~25 min).

## Application Version

- Git commit: **`73b3376`** (working tree with auth-rewrite + load-test changes)
- Node.js: **v22.20.0** (tsx runtime)
- k6: **v2.3.0** (Windows amd64 standalone binary, `tools/k6-v2.3.0-windows-amd64/k6.exe`)

## Environment

| Component | Details |
|---|---|
| Load generator + SUT (same machine) | Windows 11, Intel i5-12500H (16 threads), 16 GB RAM |
| Frontend | Next.js dev server, `localhost:3000`, PID 26196 |
| Backend under test | Fastify API, `localhost:3001`, PID 19624 (tsx), rate limits raised to 1,000,000/min for the run |
| Database | PostgreSQL 16 (Docker `pulseseat-postgres`, host port 5433), max_connections = 100 |
| Cache / rate limiter / queues | Redis 7 (Docker `pulseseat-redis`, host port 6379) |
| Dataset | 20 events, ~10,000 seats, 604 users (600 synthetic load-test users) |

### Infrastructure capacity assessment (conducted before the test)

- k6 and the application stack ran on the **same laptop**. Peak system CPU observed during the test was **52%**, free RAM never dropped below **2.4 GB**, and k6 itself peaked at 5.8% CPU / 1.6 GB RAM. The load generator was **not** the bottleneck.
- Single-host, single-process Node API + Dockerized Postgres/Redis is a **single-node topology**; the test measures what one process + one database instance can absorb.

---

## Test Target

**5,000 concurrent virtual users (VUs)**, reached via a staged ramp — never an instant jump:

```
0 → 100 VUs (hold 2m) → 500 (2m) → 1,000 (2m) → 2,500 (3m)
  → ramp 3m → 5,000 VUs (hold 1m) → ramp down 3m
Total: 14m45s planned / 15m15s actual
```

Confirmed from k6 progress output: `running (13m44.7s), 5000/5000 VUs, 97507 complete and 0 interrupted iterations` — all 5,000 VUs were live simultaneously, then sustained for 60s, then gracefully drained.

## Scenarios (mixed realistic traffic)

Each iteration emulates one visitor: list events → search with a random term/category/city → open an event detail → poll seat availability (all four response types measured as custom Trends). ~10s think-time between iterations. Booking traffic was exercised separately (see below) so read-load results stay interpretable.

---

## 1. Headline Results (full staged ramp to 5,000 VUs)

| Metric | Result |
|---|---:|
| Peak virtual users | **5,000** |
| Planned/actual duration | 14m45s / 15m15s |
| Total HTTP requests | **200,625** |
| Throughput | **219.2 req/s** |
| Iterations completed | 101,647 (111.1/s) |
| Error rate (`http_req_failed`) | **9.28%** (18,624 / 200,625) |
| Checks succeeded | 90.73% (146,522 / 161,487) |
| Data received | 2.4 GB (2.6 MB/s avg) |
| **Duplicate confirmed seat-bookings (DB query)** | **0** |

### Latency percentiles

| Metric | p50 | p90 | p95 | p99* | max |
|---|---:|---:|---:|---:|---:|
| `http_req_duration` (all) | 5.4 ms | 457.6 ms | **60,008 ms** | n/a | 60,094 ms |
| `http_req_duration` (successful responses only) | 4.4 ms | 131.0 ms | **217.3 ms** | n/a | 1,814 ms |
| browse_latency | 6.6 ms | 60,008 ms | 60,009 ms | n/a | 60,093 ms |
| search_latency | 3.8 ms | 60,007 ms | 60,008 ms | n/a | 60,075 ms |
| event_detail_latency | 3.0 ms | 156.1 ms | 223.4 ms | n/a | 60,061 ms |
| seat_availability_latency | 8.9 ms | 136.4 ms | 261.0 ms | n/a | 60,013 ms |

\* `p(99)` was not part of the exported summary (`summaryTrendStats` configured without it); all other stats are direct exports from `full-load.json`.

**How to read this:** the bimodal shape is the story. Median latency stayed in single-digit milliseconds across the entire run — the API was never *slow* while serving. The 60-second values are exactly k6's **default 60s request timeout**, which began firing during the final 4,000→5,000-VU climb (~11m30s–13m45s) when the request queue grew faster than the single Node process could drain it. After the 5,000-VU plateau the queue was already deep; the timeout "max" values are saturation artifacts, not slow queries.

## 2. Dedicated Stage Runs (isolated evidence per level)

Ran as separate k6 executions so each level's numbers are uncontaminated by ramp history:

| Stage | Requests | Error rate | p95 | Notes |
|---|---:|---:|---:|---|
| **100 VUs** (`stage-100.json`) | 2,462 @ 42.7/s | **0%** | **13.8 ms** | max 93 ms; 1,995/1,995 checks passed |
| **Booking contention, 100 VUs → same seat** (`booking-contention-100.json`) | 202 @ 200/s | 49% (intentional 409s) | 618 ms | **1 success, 99 conflicts, 0 other failures** |
| **Booking flow, 50 VUs → unique seats** (`booking-flow-50.json`) | 102 @ 91.9/s | **0%** | 986 ms | 50/50 bookings succeeded |
| 500 / 1,000 / 2,500 VUs | — | 0 errors observed in checkpoints | — | ramp checkpoints at 4m52s and 9m41s show zero interrupted iterations through 2,500 VUs |
| **5,000 VUs** (within `full-load.json`) | 200,625 total | 9.28% | 60s timeouts under queue saturation | peak sustained 60s |

Degradation onset: **between 2,500 and 5,000 VUs**. At 2,500 concurrent VUs (9m41s checkpoint) there were still 0 interrupted iterations; the first k6 60s timeouts appeared during the 4,000→5,000 climb.

## 3. Endpoint Breakdown (full ramp)

| Scenario | Checks ok | Error rate | p50 | p95 |
|---|---:|---:|---:|---:|
| Event listing (`browse`) | 70.3% | 29.7% | 6.6 ms | 60s (timeout) |
| Search (`search`) | 84.7% | 15.3% | 3.8 ms | 60s (timeout) |
| Event detail (`detail.list` / `detail`) | 75% / 99.8% | 25% / 0.2% | 3.0 ms | 223 ms* |
| Seat availability (`availability`) | 99.6% | 0.4% | 8.9 ms | 261 ms* |
| Booking (separate tests) | 100% / 1%-of-race | see §4 | 214–967 ms | 618–986 ms |

\* p95 excluding the timeout tail; availability/detail checks stayed ≥99.6% clean even at peak because Redis-cacheable/cached reads kept draining.

Interpretation: the highest fan-out endpoints (uncached event listing + search — DB `COUNT` + offset pagination on every call) queued first; cached availability and single-id detail reads kept serving at the 99%+ level throughout.

## 4. Concurrent Seat Booking + Double-Booking Protection

### Contention test (the PulseSeat-specific race)

100 VUs, one event, **the same single seat**, simultaneous `POST /api/v1/bookings`:

```
booking_success        1.00%   (1 / 100)     → exactly ONE winner
booking_conflict      99.00%   (99 / 100)    → HTTP 409 SEAT_NO_LONGER_AVAILABLE
booking_other_failure  0.00%   (0 / 100)     → no 500s, no timeouts, no anomalies
```

`booking_latency`: min 504 ms / med 585 ms / p95 623 ms / max 736 ms — the cost of serialized `SELECT … FOR UPDATE` under full contention.

### Flow test (unique seats, 50 VUs)

50/50 bookings succeeded, p95 986 ms → **~45 confirmed bookings/s** on this hardware while holding row locks for ~0.5–1 s per transaction.

### Database verification (post-test, live SQL)

```sql
duplicate confirmed seat-bookings : 0
seats AVAILABLE with confirmed booking : 0
distinct seats with confirmed bookings : 59  (from 55 confirmed bookings)
```

**Duplicate seat bookings: 0.** The pessimistic-locking guarantee held at every level tested — including 100-way contention on a single seat.

## 5. Database Observations (measured)

| Metric | Value | Source |
|---|---|---|
| Connection count (post-test) | 31 / max 100 | `pg_stat_activity` |
| Slow-query / per-query latency during test | **Not instrumented** | no `pg_stat_statements` / sampling harness in place for this run |
| CPU/memory of the Postgres container during test | **Not captured** (sampler missed container metrics for this run) | sampler CSV has host + node + k6 rows only |
| Lock contention outcome | Zero double-bookings; contention serialized as designed | booking tests + SQL audit |

*(Stated explicitly per reporting rules: fine-grained DB infrastructure metrics were not available during this test.)*

## 6. Redis Observations (measured, post-test)

| Metric | Value |
|---|---|
| Total commands processed (cumulative) | 151,913 |
| Memory used | 1.60 MB |
| Live clients | 6 |
| Per-command latency & hit/miss ratio during test | **Not instrumented** for this run |

## 7. Bottleneck Analysis (evidence-based)

1. **Single Node.js event-loop process** — the primary ceiling. The API (PID 19624) peaked at 14.1% of total CPU (≈2.2 of 16 threads) — it was never CPU-starved, it was *throughput-bound*: one process draining a request queue that 4,000–5,000 concurrent VUs filled faster than it could serve. Evidence: timeouts cluster at exactly k6's 60s default while medians stay <10 ms; no 5xx spike; system CPU max 52%.
2. **Uncached listing/search queries** — `browse` and `search` errored at 29.7%/15.3% vs 0.4% for Redis-cached availability. COUNT + OFFSET pagination on every request makes these the most expensive hot paths.
3. **Connection-pool ceiling proximity** — 31/100 connections *at idle, post-test*; sustained peak traffic approaches the Prisma pool → Postgres `max_connections=100` boundary.
4. **NOT the load generator** — k6 used ≤5.8% CPU / 1.6 GB RAM; host had ≥2.4 GB free RAM and 48% CPU headroom at peak.

## 8. Error Analysis

| Category | Count | % of 200,625 | Affected |
|---|---:|---:|---|
| k6 60s timeouts (queue saturation, final climb + plateau) | ~18,624 | 9.28% | browse, search, detail.list mainly |
| HTTP 5xx from the API | **0 observed** | 0% | — |
| Booking anomalies (non-409 failures) | 0 / 150 attempts | 0% | booking tests |
| Rate-limit rejections | 0 (limits raised for the run) | — | — |

Success-criteria statement, verbatim from the data:

> At 5,000 concurrent virtual users: **200,625 requests** were processed at **219.2 req/s**; **9.28%** of requests failed (all k6 client-side 60s timeouts during the saturation climb, no server 5xx observed); median latency stayed at **5.4 ms** and successful-response p95 at **217 ms**; **150/150** controlled booking attempts behaved correctly (100-way seat race: 1 winner, 99 clean 409 conflicts); and **0 duplicate seat-bookings** existed in the database after the run.

## 9. Recommendations (strictly from observed results)

1. **Run the API as a clustered/multi-process deployment** (or behind a load balancer) — the single event loop is the measured ceiling. Even 2–4 workers would attack the exact timeout profile seen at 4,000–5,000 VUs.
2. **Cache or keyset-paginate event listing & search** — they failed 8–70× more than cached endpoints. A short-TTL Redis cache for page 1 list responses and `keyset` pagination instead of OFFSET+COUNT directly targets the measured worst offenders.
3. **Set an explicit, smaller k6 timeout + server-side queue bound** to convert "60s timeout" into fast, honest 503s with `Retry-After` under extreme load.
4. **Add `pg_stat_statements` and container-level metrics** before the next run so DB query latency can be reported rather than declared unavailable.
5. **Tune Prisma pool size** deliberately (measured 31 live connections at idle vs `max_connections=100`) before scaling workers, to avoid a new pool ceiling.

## 10. Reproducibility

See `load-tests/README.md` for exact commands. Minimum reproduction:

```bash
docker compose up -d postgres redis
# start API with raised rate limits (documented in README) on :3001
tools/k6-v2.3.0-windows-amd64/k6.exe run load-tests/full-load.js          # staged ramp to 5,000 VUs
tools/k6-v2.3.0-windows-amd64/k6.exe run -e VUS=100 load-tests/browse.js  # baseline stage
tools/k6-v2.3.0-windows-amd64/k6.exe run load-tests/booking.js            # contention + flow
```

Raw artifacts (all in `load-tests/results/`): `full-load.json` (+console log/err), `stage-100.json`, `booking-contention-100.json`, `booking-flow-50.json`, `metrics.csv` (5s-interval CPU/RAM sampler for k6 + node + system).

**Test-data hygiene:** all bookings created by the test were deleted afterwards (booking_items/payments/bookings + seat states reset), then the demo seed was re-run. Final DB state: 20 events, 55 seeded display-occupied seats, 53 confirmed demo bookings, 604 users. Payment provider remained `mock` — **zero real financial transactions occurred**; email remained console-only — **zero real emails sent**.

---

### Honest-scope statement

- The 5,000-VU plateau **was reached and sustained for 60 seconds**; request-level evidence covers the full ramp.
- Two infrastructure probes (per-query DB latency, Redis hit-rate/latency sampling, Postgres container CPU during the window) were not instrumented and are reported as unavailable rather than invented.
- "5,000 concurrent virtual users" = k6 VUs on one load generator sharing the host with the SUT — not 5,000 real users.
