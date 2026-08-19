# PulseSeat — High-Throughput Ticket Booking Engine

**"Built for the rush."**

A concurrency-safe ticket booking platform engineered to handle thousands of simultaneous booking attempts without double-booking a single seat.

## 🎯 Problem Statement

When thousands of users try to buy tickets for the same event simultaneously, naive implementations create race conditions that lead to double-bookings. PulseSeat demonstrates how PostgreSQL transactions and row-level locking eliminate this problem at the database level.

## 🏗 Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Next.js │────▶│ Fastify  │────▶│   Redis  │
│ Frontend │     │   API    │     │  Cache   │
└──────────┘     └────┬─────┘     │  Rate    │
                      │           │  Limiting│
                      ▼           └──────────┘
                 ┌──────────┐
                 │PostgreSQL│
                 │   DB     │
                 │ (Source  │
                 │  of      │
                 │  Truth)  │
                 └──────────┘
```

### Frontend
- Next.js 15 with App Router
- TypeScript, Tailwind CSS
- TanStack Query for data fetching
- React Hook Form + Zod validation

### Backend
- Fastify with TypeScript
- Zod request validation
- Pino structured logging
- REST API with `/api/v1/` versioning

### Database
- PostgreSQL via Supabase
- Prisma ORM
- Row-level locking (`SELECT ... FOR UPDATE`)
- Deterministic lock ordering for deadlock prevention

### Caching / Distributed
- Redis for caching, rate limiting, idempotency
- BullMQ for background job processing

### Infrastructure
- Docker Compose
- Nginx reverse proxy
- Prometheus + Grafana

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

## 📊 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Create account |
| POST | `/api/v1/auth/login` | No | Sign in |
| GET | `/api/v1/auth/me` | Yes | Get current user |
| GET | `/api/v1/events` | No | List events (pagination, search, filter) |
| GET | `/api/v1/events/:id` | No | Event detail |
| GET | `/api/v1/events/:id/seats` | No | Get seats |
| GET | `/api/v1/events/:id/availability` | No | Availability summary (cached) |
| POST | `/api/v1/bookings` | Yes | **Create booking** (concurrency-safe) |
| GET | `/api/v1/bookings` | Yes | List user's bookings |
| GET | `/api/v1/bookings/:id` | Yes | Booking detail |
| POST | `/api/v1/bookings/:id/cancel` | Yes | Cancel booking |
| POST | `/api/v1/admin/events` | Admin | Create event |
| GET | `/api/v1/admin/dashboard` | Admin | Dashboard metrics |
| GET | `/api/v1/admin/analytics` | Admin | Booking analytics |
| GET | `/health` | No | Health check |
| GET | `/health/ready` | No | Readiness probe |
| GET | `/metrics` | No | Prometheus metrics |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run database migrations
pnpm db:generate
pnpm db:migrate

# Seed database
pnpm db:seed

# Start development servers
pnpm dev
```

### Docker (recommended)

```bash
docker-compose up -d
```

This starts: PostgreSQL, Redis, Nginx, Prometheus, Grafana

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pulseseat.dev | admin123 |
| User | user@pulseseat.dev | user123 |

## 🧪 Testing

### Load Testing (k6)

```bash
# Install k6
brew install k6

# Run booking load test
k6 run load-tests/booking-load-test.js

# Run high concurrency test (100 users, same seat)
k6 run load-tests/high-concurrency-test.js

# Verify zero double bookings
k6 run load-tests/verify-no-double-bookings.js
```

### Expected Results
- ✅ Successful bookings ≤ available seats
- ✅ Conflicted bookings ≥ 0
- ✅ **Double bookings = 0**

## 📈 Observability

### Prometheus Metrics
- `booking_attempts_total` — Total booking attempts
- `booking_success_total` — Successful bookings
- `booking_conflicts_total` — Conflict attempts (prevented double bookings)
- `booking_cancellations_total` — Booking cancellations

### Health Checks
- `GET /health` — Liveness
- `GET /health/ready` — Readiness (checks PostgreSQL + Redis)

### Grafana
Access at `http://localhost:3002` (admin/admin)

## 🔑 Key Engineering Decisions

1. **PostgreSQL over Redis for booking state**: Redis is fast but not ACID-compliant for our use case. PostgreSQL provides transaction guarantees.

2. **Pessimistic locking over optimistic**: For high-contention scenarios, pessimistic locking avoids retry storms.

3. **Deterministic lock ordering**: Sorting seat IDs before locking prevents deadlocks.

4. **Idempotency keys**: Prevents duplicate bookings from network retries.

5. **Background jobs for non-critical work**: Confirmation emails, invoices, analytics don't block the booking response.

6. **Database constraints as final safety net**: UNIQUE constraints on (event_id, seat_number) prevent data corruption even if application code has a bug.

## 📁 Project Structure

```
pulseseat/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Fastify backend
├── prisma/           # Database schema & seed
├── load-tests/       # k6 load tests
├── infrastructure/   # Docker, Nginx, Prometheus
└── docs/             # Architecture documentation
```

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [Concurrency Strategy](docs/concurrency.md)
- [Database Design](docs/database.md)
- [API Reference](docs/api.md)
- [Load Testing](docs/load-testing.md)

## 🛡 Security

- JWT authentication
- Role-based access control (USER/ADMIN)
- Redis rate limiting
- Input validation (Zod)
- No secrets in source control
- CORS configuration
- Security headers via Helmet

## ⚠️ Known Limitations

- Mock payment provider (no real payment integration yet)
- No WebSocket real-time updates (availability polling)
- No email service (background job queues but no SMTP)

## 🚀 Future Improvements

- Real-time seat availability via Supabase Realtime
- Stripe/Razorpay payment integration
- Elasticsearch for advanced search
- Redis Cluster for horizontal scaling
- Kubernetes deployment
- Sentry error monitoring
- E2E tests with Playwright

---

Built as a concurrency engineering showcase. The primary engineering guarantee:

> **Under concurrent load, PostgreSQL guarantees each seat can only be successfully booked once.**
