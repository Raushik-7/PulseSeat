# Architecture

## System Overview

PulseSeat follows a three-tier architecture with clear separation of concerns:

```
Client (Browser)
    ↓
Nginx (Reverse Proxy)
    ↓
Fastify API Server
    ├── Redis (OPTIONAL cache + short-lived auth tokens)
    └── PostgreSQL (Source of Truth + email outbox)
```

There are no Redis-backed background workers. The API process issues Redis
commands only while serving requests — never while idle (see
[redis-audit.md](./redis-audit.md)).

## Components

### Next.js Frontend
- Server-side rendering for public pages
- Client-side data fetching via TanStack Query
- Responsive dark-first UI
- Seat map interaction

### Fastify API
- High-throughput REST API
- Zod validation on all inputs
- Structured logging via Pino
- Request ID tracking
- Global error handling

### PostgreSQL
- **Single source of truth** for all booking state
- Transaction isolation (READ COMMITTED)
- Row-level locking via SELECT FOR UPDATE
- UNIQUE constraints as safety nets
- Strategic indexes for query performance

### Redis (optional)
- Response caching (event listings, availability, event-id lookups)
- Short-lived hashed auth tokens, with a Postgres fallback
- **Never** the source of truth for booking state
- **Optional**: every call goes through `plugins/redis-safe.ts`, which fails
  fast, degrades to Postgres, and opens a circuit breaker after repeated
  failures (quota exhaustion, provider outage). `REDIS_ENABLED=false` disables
  it entirely.

### Email outbox (PostgreSQL)
- Booking confirmation / cancellation emails
- Rows are claimed with `FOR UPDATE SKIP LOCKED`, retried with exponential
  backoff, capped and pruned — delivered by the 30s maintenance loop
- Replaces the previous BullMQ worker, whose idle `BZPOPMIN`/`EVALSHA` polling
  consumed the Redis quota with no user traffic

## Request Flow

### Booking Request
```
1. Client sends POST /api/v1/bookings
2. Nginx applies rate limiting
3. Fastify authenticates JWT
4. Fastify validates request (Zod)
5. PostgreSQL checks the idempotency key
6. PostgreSQL BEGIN TRANSACTION
7. SELECT ... FOR UPDATE (lock seats)
8. Check all seats are AVAILABLE
9. INSERT booking record
10. UPDATE seat status to BOOKED
11. COMMIT
12. Redis invalidates cache keys (best-effort; failure never fails the booking)
13. INSERT the confirmation email into `email_outbox` (+ best-effort inline send)
14. Return 201 Created
```

### On Conflict
```
7. SELECT ... FOR UPDATE (lock seat)
8. Seat status != AVAILABLE
9. ROLLBACK
10. Return 409 Conflict
```

## Scaling Strategy

### Horizontal Scaling
Multiple Fastify instances behind Nginx load balancer:
```
Nginx
  ├── API Instance 1
  ├── API Instance 2
  └── API Instance 3
         ↓
      Redis (shared, optional)
         ↓
    PostgreSQL (shared)
```

PostgreSQL remains the consistency anchor (including the email outbox, which is
claimed with `SKIP LOCKED` so every instance can drain it safely). Redis and the
application layer are stateless.

### Connection Pooling
Prisma manages a connection pool to PostgreSQL. For multiple instances, the pool size should be reduced per instance.

## Security Architecture

- JWT-based authentication (HMAC-SHA256)
- Role-based authorization validated server-side
- Rate limiting per-user and per-IP (in-process `@fastify/rate-limit`; no Redis commands)
- Input validation on all endpoints
- No secrets in source control
- Security headers via Helmet
