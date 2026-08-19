# Architecture

## System Overview

PulseSeat follows a three-tier architecture with clear separation of concerns:

```
Client (Browser)
    ↓
Nginx (Reverse Proxy)
    ↓
Fastify API Server
    ├── Redis (Cache + Rate Limiting + Idempotency)
    ├── PostgreSQL (Source of Truth)
    └── BullMQ (Background Jobs via Redis)
```

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

### Redis
- Response caching (event listings, availability)
- Rate limiting (sliding window)
- Idempotency key storage
- BullMQ job queue backend
- **Never** the source of truth for booking state

### BullMQ
- Booking confirmation emails
- Invoice generation
- Seat hold expiration
- Analytics aggregation
- Exponential backoff retries

## Request Flow

### Booking Request
```
1. Client sends POST /api/v1/bookings
2. Nginx applies rate limiting
3. Fastify authenticates JWT
4. Fastify validates request (Zod)
5. Redis checks idempotency key
6. PostgreSQL BEGIN TRANSACTION
7. SELECT ... FOR UPDATE (lock seats)
8. Check all seats are AVAILABLE
9. INSERT booking record
10. UPDATE seat status to BOOKED
11. COMMIT
12. Redis caches result / invalidates cache
13. BullMQ queues background jobs
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
      Redis (shared)
         ↓
    PostgreSQL (shared)
```

PostgreSQL remains the consistency anchor. Redis and the application layer are stateless.

### Connection Pooling
Prisma manages a connection pool to PostgreSQL. For multiple instances, the pool size should be reduced per instance.

## Security Architecture

- JWT-based authentication (HMAC-SHA256)
- Role-based authorization validated server-side
- Rate limiting per-user and per-IP
- Input validation on all endpoints
- No secrets in source control
- Security headers via Helmet
