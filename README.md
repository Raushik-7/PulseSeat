# PulseSeat — High-Throughput Ticket Booking Engine

**"Built for the rush."**

A concurrency-safe ticket booking platform engineered to handle thousands of simultaneous booking attempts without double-booking a single seat — with real authentication, real payments, real-time seat updates, and measured load-test evidence.

## 🎯 Problem Statement

When thousands of users try to buy tickets for the same event simultaneously, naive implementations create race conditions that lead to double-bookings. PulseSeat demonstrates how PostgreSQL transactions and row-level locking eliminate this problem at the database level — and proves it with reproducible k6 load tests (see [`PULSESEAT_LOAD_TEST_REPORT.md`](PULSESEAT_LOAD_TEST_REPORT.md)).

## 🏗 Architecture

```
┌──────────┐     ┌──────────┐     ┌───────────────┐
│  Next.js │────▶│ Fastify  │────▶│ Redis (opt.)  │
│ Frontend │ WS  │   API    │     │ cache + short │
└──────────┘◀────└────┬─────┘     │ -lived tokens │
   (Socket.io)        │           └───────────────┘
                      ▼
                 ┌──────────────┐
                 │ PostgreSQL   │──▶ source of truth
                 │   DB         │──▶ email outbox (no Redis queue,
                 └──────────────┘     no idle worker polling)
```

Redis is an optional cache: if it is unavailable the API serves reads from
PostgreSQL. There are no Redis-backed background workers — booking emails drain
from a Postgres outbox on the 30s maintenance loop. See
[docs/redis-audit.md](docs/redis-audit.md) for the command-consumption audit.

### Frontend
- Next.js 15.5 (App Router) + React 19, TypeScript, Tailwind CSS
- TanStack Query for data fetching
- React Hook Form + Zod validation
- Socket.io client for live seat updates
- 29 pages: discovery, booking flow, auth suite, admin suite, policy/content pages

### Backend
- Fastify + TypeScript (tsx in dev, compiled for production)
- Zod request validation with a root-scoped global error handler
- Pino structured logging
- REST API with `/api/v1/` versioning
- Socket.io WebSocket gateway for real-time seat availability

### Database
- PostgreSQL (works with any Postgres 14+; Supabase-compatible) via Prisma ORM
- Row-level locking (`SELECT ... FOR UPDATE`)
- Deterministic lock ordering for deadlock prevention
- DB-level UNIQUE constraints as the final double-booking safety net

### Caching / Distributed
- Redis for caching (event/availability) and short-lived hashed auth tokens — optional, with Postgres fallbacks
- Redis commands are issued only while serving requests: no workers, no polling, no idle background traffic
- Rate limiting is in-process (`@fastify/rate-limit`) and costs zero Redis commands
- Postgres email outbox for asynchronous delivery with retry/backoff (replaces BullMQ)

### Payments
- **Stripe Payment Intents** integration (PCI-compliant, webhook-verified) — real provider
- **Mock provider** for development/testing (auto-confirm, zero external calls)
- Selected via `PAYMENT_PROVIDER=stripe|mock`

### Email
- Nodemailer SMTP transport for verification, password reset, booking confirmation, and cancellation emails
- Booking emails are queued in the Postgres `email_outbox` and delivered by the maintenance loop (at-least-once, exponential backoff, capped attempts); without SMTP config the transport logs to console (dev mode)

## 🔐 Authentication

Email + password authentication with real email verification (no social login, no dev-mode OTP):

- **Signup** → creates an unverified account → emails a verification link (token hashed in Redis, TTL-based)
- **Verify email** → `/verify-email?token=…&email=…` → account verified → JWT issued
- **Login** → blocked with `403 EMAIL_NOT_VERIFIED` until verified
- **Forgot / reset password** → emailed reset link with single-use token
- **Resend verification** → rate-limited via Redis anti-spam guard
- JWT (HMAC-SHA256) sessions, role-based access control (`USER` / `ADMIN`)

### Auth API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Create account (sends verification email) |
| POST | `/api/v1/auth/verify-email` | No | Verify email with token |
| POST | `/api/v1/auth/resend-verification` | No | Resend verification email |
| POST | `/api/v1/auth/login` | No | Sign in (requires verified email) |
| POST | `/api/v1/auth/forgot-password` | No | Request password reset email |
| POST | `/api/v1/auth/reset-password` | No | Reset password with token |
| GET | `/api/v1/auth/me` | Yes | Get current user |

## 🔐 Concurrency Strategy

The booking flow uses PostgreSQL pessimistic locking:

```sql
BEGIN;

-- Lock the seat row (other transactions wait)
SELECT * FROM seats
WHERE id = ANY('{seat1, seat2, seat3}')
ORDER BY id ASC           -- Deterministic lock order
FOR UPDATE;

-- Check ALL seats are available
-- If any unavailable → ROLLBACK (atomic, no partial booking)

-- Create booking
INSERT INTO bookings ...

-- Update seats
UPDATE seats SET status = 'BOOKED'
WHERE id = ANY('{seat1, seat2, seat3}');

COMMIT;
```

**Proven under load** (from the actual test run — full data in the report):

| Test | Result |
|---|---|
| 100 VUs racing for the **same seat** | **1 success, 99 clean 409 conflicts, 0 anomalies** |
| Unique-seat booking flow | 50/50 succeeded, ~45 bookings/s, p95 ≈ 986 ms |
| Staged ramp to **5,000 concurrent VUs** | 200,625 requests @ 219 req/s; 0 duplicate bookings in DB |
| Double-booking verification (SQL audit) | **0** duplicates across all confirmed bookings |

## 📊 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Create account |
| POST | `/api/v1/auth/verify-email` | No | Verify email |
| POST | `/api/v1/auth/resend-verification` | No | Resend verification |
| POST | `/api/v1/auth/login` | No | Sign in |
| POST | `/api/v1/auth/forgot-password` | No | Request reset |
| POST | `/api/v1/auth/reset-password` | No | Reset password |
| GET | `/api/v1/auth/me` | Yes | Get current user |
| GET | `/api/v1/events` | No | List events (pagination, search, city + category filters) |
| GET | `/api/v1/events/:id` | No | Event detail |
| GET | `/api/v1/events/:id/seats` | No | Get seats (tiered pricing, best-view flags) |
| GET | `/api/v1/events/:id/availability` | No | Availability summary (Redis-cached) |
| POST | `/api/v1/bookings` | Yes | **Create booking** (concurrency-safe, idempotent) |
| GET | `/api/v1/bookings` | Yes | List user's bookings |
| GET | `/api/v1/bookings/:id` | Yes | Booking detail |
| POST | `/api/v1/bookings/:id/cancel` | Yes | Cancel booking |
| POST | `/api/v1/payments/create-intent` | Yes | Create Stripe PaymentIntent |
| POST | `/api/v1/webhooks/stripe` | Signature | Stripe webhook (payment confirmation) |
| POST | `/api/v1/admin/events` | Admin | Create event |
| GET | `/api/v1/admin/dashboard` | Admin | Dashboard metrics |
| GET | `/api/v1/admin/analytics` | Admin | Booking analytics |
| GET | `/health` | No | Health check |
| GET | `/health/ready` | No | Readiness probe |
| GET | `/metrics` | No | Prometheus metrics |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (tested on 22)
- pnpm 9
- Docker (for PostgreSQL + Redis) — or native installs

### Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env   # if present; otherwise create .env per the table below
# Edit .env — minimum: DATABASE_URL, JWT_SECRET (REDIS_URL is optional)

# Start infrastructure (Postgres on host port 5433, Redis on 6379)
docker compose up -d postgres redis

# Run database migrations
pnpm db:generate
pnpm db:migrate

# Seed database (20 Indian events, 3 unique images each, full seat maps, demo users)
pnpm db:seed

# Validate event images (uniqueness + every URL reachable; --db reports live DB stats)
pnpm --filter @pulseseat/prisma validate:images
pnpm --filter @pulseseat/prisma validate:images:db

# Start development servers (web :3000, api :3001)
pnpm dev
```

> **Port note:** the Docker Postgres is exposed on host port **5433** (not 5432) to avoid clashing with native PostgreSQL installs. Point `DATABASE_URL` at `localhost:5433` when using the container.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `DIRECT_URL` | — | Direct (non-pooled) URL for migrations |
| `REDIS_URL` | — | Redis connection string (`redis://localhost:6379`); any provider (`rediss://` for TLS) |
| `REDIS_ENABLED` | — | `false` disables Redis entirely (quota-outage escape hatch) |
| `REDIS_CONNECT_TIMEOUT_MS` / `REDIS_COMMAND_TIMEOUT_MS` | — | Fail-fast budgets (default 3000 / 1500) |
| `REDIS_BREAKER_COOLDOWN_MS` | — | Circuit-breaker cooldown after repeated failures (default 30000) |
| `JWT_SECRET` | ✅ | HMAC secret for JWT signing — **use a strong random value in production** |
| `JWT_EXPIRES_IN` | — | Token lifetime (default `7d`) |
| `API_PORT` / `API_HOST` | — | API bind config (default `3001`) |
| `NEXT_PUBLIC_API_URL` | — | Frontend → API base URL (default `http://localhost:3001`) |
| `NEXT_PUBLIC_APP_URL` | — | App URL used in email links (default `http://localhost:3000`) |
| `PAYMENT_PROVIDER` | — | `mock` (default, dev) or `stripe` |
| `PAYMENT_SECRET` | — | Stripe secret key (required when provider = `stripe`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | Real email delivery; if unset, emails log to console (dev) |
| `RATE_LIMIT_GENERAL` / `RATE_LIMIT_BOOKING` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_WINDOW_MS` | — | In-process rate-limit tuning |
| `BOOKING_HOLD_DURATION_MS` | — | Seat hold window |
| `BOOKING_IDEMPOTENCY_EXPIRY_S` | — | Idempotency key TTL |
| `EMAIL_OUTBOX_BATCH_SIZE` / `EMAIL_OUTBOX_MAX_ATTEMPTS` / `EMAIL_OUTBOX_RETRY_BASE_MS` | — | Postgres email-outbox drain tuning |

### Docker (full stack)

```bash
docker-compose up -d
```

This starts: PostgreSQL (5433), Redis, API (3001), Web (3000), Nginx (80), Prometheus (9090), Grafana (3002). A k6 container is available under the `loadtest` profile.

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pulseseat.dev | admin123 |
| User | user@pulseseat.dev | user123 |

> These seeded accounts are pre-verified. New signups go through the real email-verification flow (console-logged in dev without SMTP).

## 🎟 Demo Data

The seed creates a realistic Indian event catalogue:

- **20 events** across Music / Technology / Comedy / Film / Sports / Dance
- **13 cities** with real venues (DY Patil Stadium, Jio World Convention Centre, HITEX, Narendra Modi Stadium, …)
- **3 unique images per event** (60 distinct URLs, zero reuse)
- **Full seat maps per event** — VIP / Premium / General price tiers, ⭐ best-view seats, deterministic pre-booked seats

## 🧪 Testing

### Load Testing (k6)

Scripts live in `load-tests/` (runner binary used for the report: `tools/k6-v2.3.0-windows-amd64/k6.exe`; any k6 ≥ 0.50 works).

```bash
# Staged ramp: 100 → 500 → 1,000 → 2,500 → 5,000 VUs (≈15 min)
k6 run load-tests/full-load.js

# Mixed read traffic (browse / search / detail / seat availability)
k6 run -e VUS=100 load-tests/browse.js

# Booking tests: contention (same-seat race) + unique-seat flow
k6 run load-tests/booking.js

# Quick health check
k6 run load-tests/health-check.js
```

Raw outputs are kept in `load-tests/results/` (`*.json` summaries, console logs, and a CPU/RAM sampler CSV). Full methodology, measured percentiles, bottleneck analysis, and reproducibility instructions: **[`PULSESEAT_LOAD_TEST_REPORT.md`](PULSESEAT_LOAD_TEST_REPORT.md)** and [`load-tests/README.md`](load-tests/README.md).

> Load-test hygiene: booking tests run against synthetic load-test users, all test bookings are cleaned up afterwards, payments stay on the `mock` provider, and emails stay console-only — no real transactions or emails are ever generated.

### Unit / Integration / Concurrency Tests

```bash
pnpm test                # API test suite
pnpm test:unit
pnpm test:integration
pnpm test:concurrency    # simultaneous booking race assertions
```

### Expected Concurrency Results
- ✅ Successful bookings ≤ available seats
- ✅ Conflicted bookings get clean `409` responses
- ✅ **Double bookings = 0** (verified by SQL audit after every run)

## 📈 Observability

### Prometheus Metrics
- `booking_attempts_total` — Total booking attempts
- `booking_success_total` — Successful bookings
- `booking_conflicts_total` — Conflict attempts (prevented double bookings)
- `booking_cancellations_total` — Booking cancellations

### Health Checks
- `GET /health` — Liveness (no dependencies, zero Redis commands)
- `GET /health/ready` — Readiness: PostgreSQL only (zero Redis commands — safe for keep-alive/uptime pings)
- `GET /health/deps` — Manual diagnosis: PostgreSQL, one circuit-breaker-aware Redis PING, email-outbox depth


## 🔑 Key Engineering Decisions

1. **PostgreSQL over Redis for booking state**: Redis is fast but not ACID-compliant for our use case. PostgreSQL provides transaction guarantees.

2. **Pessimistic locking over optimistic**: For high-contention scenarios, pessimistic locking avoids retry storms. Measured: 100-way same-seat race resolves as exactly 1 winner + 99 clean conflicts.

3. **Deterministic lock ordering**: Sorting seat IDs before locking prevents deadlocks.

4. **Idempotency keys**: Prevents duplicate bookings from network retries.

5. **Background jobs for non-critical work**: Confirmation emails don't block the booking response, and they are durable — a Postgres outbox rather than a Redis worker, so asynchronous delivery costs no idle Redis commands.

6. **Database constraints as final safety net**: UNIQUE constraints on (event_id, seat_number) prevent data corruption even if application code has a bug.

7. **Real email verification over dev shortcuts**: Accounts are unusable until verified via emailed token; tokens are stored hashed with TTLs in Redis, with a Postgres fallback when Redis is unavailable.

8. **Provider-swappable payments**: `PAYMENT_PROVIDER=mock|stripe` — same booking flow, no code changes, no accidental real charges in dev/test.

## 📁 Project Structure

```
pulseseat/
├── apps/
│   ├── web/          # Next.js 15 frontend (29 routes: discovery, booking, auth, admin, policies)
│   └── api/          # Fastify backend (auth, events, seats, bookings, payments, admin, webhooks)
├── prisma/           # Schema + seed (20 events, seat maps, verified demo users)
├── load-tests/       # k6 scripts + raw results (staged 5,000-VU test)
├── infrastructure/   # Docker, Nginx, Prometheus configs
├── docs/             # Architecture documentation
├── PULSESEAT_LOAD_TEST_REPORT.md   # Measured 5,000-VU performance report
└── docker-compose.yml
```

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [Redis Usage Audit](docs/redis-audit.md) — command consumption, circuit breaker, provider migration
- [Concurrency Strategy](docs/concurrency.md)
- [Database Design](docs/database.md)
- [API Reference](docs/api.md)
- [Load Testing](docs/load-testing.md)
- [Load Test Report (measured results)](PULSESEAT_LOAD_TEST_REPORT.md)
- [Deployment Guide](docs/deployment.md)
- [Ops Runbook (incidents, outages, health probes)](docs/ops-runbook.md)
- [Free-Tier Deployment Walkthrough (step-by-step)](docs/free-tier-deployment-walkthrough.md)

## 🛡 Security

- JWT authentication (HMAC-SHA256, configurable expiry)
- Email verification required before first login
- Single-use, hashed, TTL-bound tokens for verification and password reset
- Role-based access control (USER/ADMIN)
- Rate limiting (general / booking / login buckets), in-process — no Redis dependency
- Input validation (Zod) with a global error handler — validation failures return structured 400s, never stack traces
- Stripe webhook signature verification
- No secrets in source control
- CORS configuration
- Security headers via Helmet

## ✅ Production Features

- **Stripe Payment Integration** — Real PCI-compliant payments via Stripe Payment Intents + signature-verified webhooks. Mock provider for dev.
- **Real-Time Seat Updates** — Socket.io WebSocket broadcasting seat status changes to all connected clients instantly.
- **Email Notifications** — SMTP-powered verification, password reset, booking confirmation, and cancellation emails via Nodemailer, delivered asynchronously from a Postgres outbox.
- **Durable Background Jobs Without a Broker** — booking emails are claimed with `SKIP LOCKED` and retried with backoff, with no Redis worker polling the queue while idle.
- **Real Authentication** — Email + password with mandatory email verification, forgot/reset password, rate-limited auth endpoints.
- **Measured Performance** — k6 load-tested to 5,000 concurrent virtual users with a published, reproducible report and zero double-bookings verified in the database.

## 🚀 Future Improvements

- Elasticsearch for advanced search
- Redis Cluster for horizontal scaling
- Multi-process/multi-instance API deployment (measured bottleneck: single Node event loop — see report §7)
- Keyset pagination + list-response caching for event listing/search
- Kubernetes deployment
- Sentry error monitoring
- E2E tests with Playwright

---

Built as a concurrency engineering showcase. The primary engineering guarantee:

> **Under concurrent load, PostgreSQL guarantees each seat can only be successfully booked once.**
