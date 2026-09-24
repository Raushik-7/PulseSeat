# Deploying PulseSeat

> **Vercel quick-start:** the **frontend deploys to Vercel's free tier** (Next.js auto-detected, zero config). The **API cannot run on Vercel** — it's a long-running Fastify + Socket.io + BullMQ server (persistent WebSocket + background workers), which Vercel's serverless functions don't support. Deploy the API free on **Railway / Render / Fly.io**. Steps below; Vercel-specific details in [§ Vercel Deployment Steps](#vercel-deployment-steps-frontend).

Two proven paths, from simplest to most production-grade. Pick based on budget and scale.

---

## Path A — Single VPS with Docker Compose (fastest full-stack deploy)

**Best for:** demos, portfolios, small real events. One machine, everything containerized.

### 1. Provision a server

- Any VPS with 2 vCPU / 4 GB RAM minimum (Hetzner CX22, DigitalOcean, Vultr, AWS Lightsail, EC2)
- Ubuntu 22.04/24.04, Docker + Docker Compose plugin installed
- A domain (or subdomain) pointed at the server's IP: e.g. `pulseseat.example.com` (web), `api.pulseseat.example.com` (API)

### 2. Ship the code

```bash
# On the server
git clone <your-repo-url> /opt/pulseseat
cd /opt/pulseseat
```

### 3. Create the production `.env`

```bash
# Postgres (internal compose network — host "postgres", port 5432)
DATABASE_URL="postgresql://postgres:<STRONG_DB_PASSWORD>@postgres:5432/pulseseat?schema=public"
DIRECT_URL="postgresql://postgres:<STRONG_DB_PASSWORD>@postgres:5432/pulseseat?schema=public"

# Redis (internal compose network)
REDIS_URL="redis://redis:6379"

# Auth — generate with: openssl rand -hex 48
JWT_SECRET="<STRONG_RANDOM_SECRET>"
JWT_EXPIRES_IN="7d"

# Public URLs (must be the real, HTTPS, publicly-resolvable URLs)
API_PORT=3001
NEXT_PUBLIC_API_URL="https://api.pulseseat.example.com"
NEXT_PUBLIC_APP_URL="https://pulseseat.example.com"

# Payments — real Stripe
PAYMENT_PROVIDER="stripe"
PAYMENT_SECRET="sk_live_..."            # or sk_test_... for sandbox

# Email — real SMTP (Resend, Postmark, SES, Mailgun all work)
SMTP_HOST="smtp.postmarkapp.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="PulseSeat <tickets@pulseseat.example.com>"

# Rate limits — keep defaults in production
RATE_LIMIT_GENERAL=100
RATE_LIMIT_BOOKING=30
RATE_LIMIT_LOGIN=10
RATE_LIMIT_WINDOW_MS=60000

NODE_ENV=production
LOG_LEVEL=info
```

> ⚠️ `NEXT_PUBLIC_*` variables are **baked into the web bundle at build time**. Set them before `docker compose build`, not after.

### 4. Build, migrate, seed

```bash
docker compose build

# Migrate + seed (run the API container's Prisma CLI, or a local run against the server DB)
docker compose up -d postgres redis
sleep 10
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npx prisma db seed   # optional: demo data; skip for a clean prod DB
```

### 5. Start everything

```bash
docker compose up -d
docker compose ps        # all services healthy?
```

Services: web :3000, api :3001, postgres :5433 (host) / 5432 (internal), redis :6379, nginx :80, prometheus :9090, grafana :3002.

### 6. HTTPS + reverse proxy

Put Nginx (already in compose) or a Caddy/Traefik container in front with TLS:

```bash
# Simplest: install certbot on the host and proxy 80/443 → compose's nginx,
# or swap the nginx service for Caddy (automatic HTTPS):
# caddy → web:3000 (/*), api:3001 (/api/*, /socket.io/*, /metrics protected)
```

Required for: Stripe webhooks (HTTPS only), secure cookies, WebSocket (wss://).

### 7. Verify

```bash
curl https://api.pulseseat.example.com/health/ready     # {"status":"ok"} → DB + Redis connected
curl -I https://pulseseat.example.com                   # 200
```

Then: sign up with a real email → receive verification email → verify → book a test seat with Stripe test card `4242 4242 4242 4242`.

---

## Path B — Split managed services (recommended for real production)

**Best for:** reliability without ops burden. Each piece on its best-fit platform.

| Component | Service | Why |
|---|---|---|
| **Web** (Next.js) | **Vercel** | Zero-config Next.js hosting; set `NEXT_PUBLIC_*` in project env before build |
| **API** (Fastify) | **Railway / Render / Fly.io** | Container or Node runtime; auto-deploy from git; HTTPS included |
| **PostgreSQL** | **Supabase or Neon** | Managed Postgres + pooled connection strings; project already uses Prisma with Supabase-compatible env vars |
| **Redis** | **Upstash or Redis Cloud** | Managed Redis, TLS URL works directly as `REDIS_URL` |
| **Email** | **Resend / Postmark / SES** | SMTP creds feed straight into the existing Nodemailer config |
| **Payments** | **Stripe** | Live keys + webhook endpoint |

### Steps

1. **Provision Postgres** (Supabase/Neon). Copy the **pooled** connection string → `DATABASE_URL`, and the **direct** one → `DIRECT_URL` (migrations need direct).
2. **Provision Redis** (Upstash). Copy the TLS URL → `REDIS_URL`.
3. **Deploy the API** (Railway/Render/Fly): root dir `apps/api` (or repo root with Dockerfile), set all non-`NEXT_PUBLIC` env vars, then run a one-off command: `npx prisma migrate deploy` (+ optional `db:seed`).
4. **Deploy the Web** (Vercel): root dir `apps/web`, set `NEXT_PUBLIC_API_URL=https://<your-api-host>` and `NEXT_PUBLIC_APP_URL=https://<your-web-domain>` **before** the first build.
5. **Stripe**: dashboard → Developers → Webhooks → add endpoint `https://<api-host>/api/v1/webhooks/stripe` with event `payment_intent.succeeded` (and `payment_intent.payment_failed`); copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
6. **WebSocket note:** Socket.io clients connect to the API host (`NEXT_PUBLIC_API_URL`). Railway/Render/Fly support WebSockets natively; ensure any proxy in front forwards `Upgrade`/`Connection` headers.
7. **Scaling note (measured):** the load test found the single Node event loop is the ceiling (~219 req/s, timeouts at 4–5k VUs). Run ≥2 API instances behind the platform's load balancer. **Important:** with multiple instances, add `@socket.io/redis-adapter` so seat-update broadcasts reach clients connected to *other* instances — booking correctness is unaffected (Postgres locks are), only the live broadcast is per-instance until this is added.

---

## Environment Variable Checklist (production)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Pooled Postgres URL | Supabase pooler / Neon pooled |
| `DIRECT_URL` | Direct Postgres URL | For `migrate deploy` |
| `REDIS_URL` | Redis TLS URL | `rediss://…` on managed providers |
| `JWT_SECRET` | `openssl rand -hex 48` | **Never** the dev value |
| `NEXT_PUBLIC_API_URL` | Public HTTPS API URL | Set **before** web build |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS web URL | Used in verification/reset email links — wrong value = dead links |
| `PAYMENT_PROVIDER` | `stripe` | `mock` only for dev/demo |
| `PAYMENT_SECRET` | `sk_live_…` / `sk_test_…` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From Stripe webhook endpoint |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Provider SMTP creds | Without these, emails only log to console |
| `RATE_LIMIT_*` | Keep defaults | Don't ship the load-test values (`1000000`) |
| `NODE_ENV` | `production` | |

## Pre-Launch Checklist

- [ ] `GET /health/ready` returns ok (Postgres + Redis reachable)
- [ ] `prisma migrate deploy` ran against the production DB (never `migrate reset` / `db:push`)
- [ ] Signup → verification email arrives → login works end-to-end
- [ ] Forgot-password email link uses the correct `NEXT_PUBLIC_APP_URL`
- [ ] Stripe test-mode booking succeeds end-to-end, then webhooks deliver (Stripe dashboard → webhook attempts)
- [ ] Seat map loads and two-browser booking race resolves correctly (one success, one 409)
- [ ] WebSocket updates visible live (book a seat in one tab; another tab updates without refresh)
- [ ] HTTPS on both domains; no mixed-content warnings
- [ ] Grafana default password changed or Grafana not exposed publicly
- [ ] `/metrics` not publicly accessible (reverse-proxy allowlist)
- [ ] Seeded demo accounts (`user@…`, `admin@…`) removed or their passwords rotated
- [ ] Backups: managed Postgres automated backups enabled (or `pg_dump` cron on VPS)

## Cost Sketch (Path B)

| Piece | Service | ~Monthly |
|---|---|---|
| Web | Vercel Hobby/Pro | $0–20 |
| API | Railway/Render starter | $5–10 |
| Postgres | Supabase/Neon free–starter | $0–25 |
| Redis | Upstash pay-as-you-go | $0–10 |
| Email | Resend/Postmark | $0–15 |
| **Total** | | **~$10–80** |

Path A is just the VPS: ~$5–15/month.

---

## Vercel Deployment Steps (Frontend)

The web app is standard Next.js 15 App Router — Vercel requires **zero extra config** (no `vercel.json` needed; no custom headers/rewrites/cron are used — the `/api` rewrite in `next.config.js` is a **dev-only convenience** and unused in production because the client calls `NEXT_PUBLIC_API_URL` directly).

### 1. Push the repo to GitHub

### 2. Import into Vercel
- vercel.com → **Add New Project** → import the repo
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `apps/web`
- **Build Command / Output:** leave defaults (`next build`)
- **Node.js Version:** 22.x (project settings)

### 3. Set environment variables (Project → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-api-host>` (e.g. Railway URL) | Baked at **build time** — set BEFORE first deploy |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` | Email links + automatic CORS origin |
| `NEXT_PUBLIC_SHOW_ERROR_OVERLAY` | `false` | Optional |

> Changing `NEXT_PUBLIC_*` later requires a **redeploy** (rebuild) to take effect.

### 4. Deploy the API somewhere that supports long-running processes
- **Railway** (free trial, then $5/mo hobby): root dir `apps/api`, start command `npm run start`, add all non-`NEXT_PUBLIC` env vars from `.env.example`, then one-off `npx prisma migrate deploy`
- **Render** (free web service sleeps — WebSocket reconnects handle it): build `npm install && npm run build`, start `node dist/server.js`
- **Fly.io**: `fly launch --dockerfile apps/api/Dockerfile` (if Dockerfile present) or Node runtime
- Attach **Supabase/Neon** (Postgres) and **Upstash** (Redis) free tiers

### 5. Wire the two sides together
- API env: `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app` and optionally `CORS_ORIGINS=https://<project>.vercel.app` (any `*.vercel.app` origin is already accepted automatically)
- Redeploy the web app **after** the API is live so the baked `NEXT_PUBLIC_API_URL` is correct

### 6. Verify
```bash
curl https://<api-host>/health/ready          # postgres + redis healthy
curl -I https://<project>.vercel.app          # 200
```
Then in the browser: sign up → verification email → login → browse → seat select → book (mock provider) → My Bookings. Real-time: open the same event in two tabs; a booking in one updates the other.

### What CANNOT run on Vercel's free tier (or at all)

| Component | Why | Free-tier home |
|---|---|---|
| **API server (Fastify + Socket.io + BullMQ)** | Persistent WebSocket server + long-running background workers; Vercel functions are stateless & time-limited | Railway / Render / Fly free/cheap tiers |
| **PostgreSQL** | Vercel doesn't host databases | Supabase / Neon free tiers |
| **Redis** | Not hosted by Vercel | Upstash free tier |
| **BullMQ workers** | Long-lived processes | Run inside the API deployment |
| Vercel Cron | Not used by this app (job scheduling is BullMQ/Redis) | — |
