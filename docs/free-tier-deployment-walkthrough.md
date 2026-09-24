# PulseSeat — Complete Free-Tier Deployment Walkthrough

Follow the phases **in order**. Each phase depends on the previous one. Total time: ~45–60 minutes.

**The one concept that makes this easy:** you do NOT upload files to Vercel/Railway/Render individually. You push the **entire repo to GitHub once**, and each platform imports from GitHub and builds only its own folder:

| Platform (all free tier) | What it hosts | Folder it builds | Files it actually uses |
|---|---|---|---|
| **GitHub** | source of truth | — | the whole repo |
| **Supabase** | PostgreSQL | — | `prisma/schema.prisma` (via SQL/migrate) |
| **Upstash** | Redis | — | nothing (just gives you a URL) |
| **Railway / Render** | Fastify API | `apps/api` | `apps/api/package.json`, `apps/api/src/**`, `prisma/schema.prisma` |
| **Vercel** | Next.js web | `apps/web` | `apps/web/**` only |

---

## Phase 0 — Push the repo to GitHub (10 min)

Everything downstream imports from GitHub, so this comes first.

1. Create a GitHub account (if needed) → github.com → **New repository** → name `pulseseat` → **Private** → Create.
2. Locally, from the project root:
   ```bash
   git add .
   git commit -m "PulseSeat: production deployment prep"
   git branch -M main
   git remote add origin https://github.com/<your-username>/pulseseat.git
   git push -u origin main
   ```
3. **Verify `.env` is NOT pushed** (it contains secrets): check the repo on github.com — you should see `README.md`, `apps/`, `prisma/`… but **no `.env`**. `.gitignore` already excludes it. If you ever accidentally commit it: rotate `JWT_SECRET` and all keys, then remove from history.

> Note: `apps/web` has NO own `.env` file in git and needs none — Vercel injects its two variables at build time (Phase 4).

---

## Phase 1 — Database: Supabase Postgres (15 min)

1. supabase.com → **Sign up** (free, GitHub login works) → **New project**.
   - Name: `pulseseat`, choose a region near you, set a **database password** (SAVE IT — shown once).
2. When the project is ready (≈2 min), go to **Project Settings → Database → Connection string → URI**.
3. You now have two URLs — copy both:
   - **Connection pooling** (port `6543`, `pgbouncer=true`) → this is your **`DATABASE_URL`**
   - **Direct connection** (port `5432`) → this is your **`DIRECT_URL`** (migrations must bypass the pooler)
4. Replace `[YOUR-PASSWORD]` in both with the password you saved. They look like:
   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```

**Create the schema** — locally, from the project root (this runs the real migration, not `db push`):
```bash
cd prisma
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" npx prisma db seed   # optional demo data
```
Verify in Supabase → **Table Editor**: `events`, `seats`, `users`, `bookings` exist with 20 events (if you seeded).

---

## Phase 2 — Cache: Upstash Redis (5 min)

1. upstash.com → **Sign up free** → **Create database** (name `pulseseat`, same region as Supabase, **Regional** type).
2. Open the database → **REST… no — connect via `REDIS_URL`:** in the **Details** tab find **Endpoint + Port** and copy the connection string shown under "Connect with Redis client", or build it:
   `rediss://default:<password>@<endpoint>.upstash.io:6379`
3. That URL is your **`REDIS_URL`**. (Upstash free tier = 10k commands/day — fine for a demo.)

---

## Phase 3 — API: Railway or Render (20 min)

The API is a long-running Fastify + Socket.io + BullMQ server — it needs a platform that keeps processes alive (Vercel cannot host it). Both options below import the **same** GitHub repo and only build `apps/api`.

### Option A — Railway (recommended, WebSocket-native)

1. railway.app → **Sign up with GitHub** → **New Project → Deploy from GitHub repo** → pick `pulseseat`.
2. Railway detects the monorepo — go to the service → **Settings**:
   - **Root Directory:** `/apps/api`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
3. **Variables** tab → add (values from Phase 1/2):
   ```
   DATABASE_URL=<pooled Supabase URL>
   DIRECT_URL=<direct Supabase URL>
   REDIS_URL=<Upstash rediss URL>
   JWT_SECRET=<openssl rand -hex 48 output>
   NEXT_PUBLIC_APP_URL=https://pulseseat-web.vercel.app
   CORS_ORIGINS=https://pulseseat-web.vercel.app
   PAYMENT_PROVIDER=mock
   NODE_ENV=production
   NIXPACKS_NODE_VERSION=22
   ```
4. **Settings → Networking → Generate Domain** → Railway gives you e.g. `https://pulseseat-api-production.up.railway.app`. **Copy it.**

### Option B — Render (truly free tier, sleeps after 15 min idle)

1. render.com → **Sign up with GitHub** → **New → Web Service** → connect the repo.
2. Settings:
   - **Root Directory:** `apps/api`
   - **Runtime:** Node · **Build Command:** `npm install && npm run build` · **Start Command:** `npm run start`
   - **Instance type:** Free
3. **Environment** tab → same variables as Railway's table above.
4. **Create Web Service** → copy the URL `https://<name>.onrender.com`.

> Render free services sleep; the web app's Socket.io client auto-reconnects, so the first visit after idling is just slower. Railway doesn't sleep but its free trial is time-limited.

### Verify the API (before touching Vercel)

```bash
curl https://<api-url>/health/ready
# {"status":"ready","checks":{"postgres":{"status":"healthy"},...}}
curl "https://<api-url>/api/v1/events?limit=1"
# {"success":true,"data":[...20 events...]}
```

---

## Phase 4 — Web: Vercel (15 min)

1. vercel.com → **Sign up with GitHub** → **Add New → Project** → **Import** `pulseseat`.
2. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web` (click Edit)
   - **Build / Output / Install:** leave as defaults
3. **Environment Variables** (before clicking Deploy!):
   ```
   NEXT_PUBLIC_API_URL = https://<api-url-from-phase-3>
   NEXT_PUBLIC_APP_URL = https://<your-project>.vercel.app
   NEXT_PUBLIC_SHOW_ERROR_OVERLAY = false
   ```
   `NEXT_PUBLIC_*` values are **baked into the JS bundle at build time** — wrong or missing here = the site builds but can't reach the API.
   > `NEXT_PUBLIC_APP_URL` should be the final Vercel domain. If you don't know it yet, deploy once, copy the URL from the dashboard (`<name>.vercel.app`), fix the variable, and **Redeploy**.
4. **Deploy** → wait ~2 min → open `https://<project>.vercel.app`.

---

## Phase 5 — Wire the two halves together (5 min)

The API must accept browser requests from the Vercel domain:

1. Railway/Render → API service → **Variables**: ensure
   - `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app` (used in verification emails + auto-allowed as CORS origin)
   - `CORS_ORIGINS=https://<project>.vercel.app` (extra origins if you add custom domains later)
   (Any `*.vercel.app` origin is accepted automatically — these two make it explicit.)
2. Change a variable → the platform redeploys the API automatically.
3. End-to-end test in the browser:
   - Sign up with a **real email** → (dev SMTP: the verification link is printed in the API logs on Railway/Render → copy it into the browser) → verify → log in
   - Browse events → open one → pick seats → Book → **My Bookings** shows it
   - Open the same event in **two tabs**; book a seat in one → the other updates live (WebSocket)

---

## Phase 6 — Real payments & email (optional, still free)

**Stripe (test mode — no real money):**
1. dashboard.stripe.com → **Developers → API keys** → copy the **Secret key** (`sk_test_...`).
2. Railway/Render variables: `PAYMENT_PROVIDER=stripe`, `PAYMENT_SECRET=sk_test_...`
3. **Developers → Webhooks → Add endpoint** → `https://<api-url>/api/v1/webhooks/stripe` → event `payment_intent.succeeded` → copy signing secret → variable `STRIPE_WEBHOOK_SECRET=whsec_...`

**Real email (so verification mail actually arrives):**
1. resend.com or postmarkapp.com → free account → verify a sender domain (or use their sandbox sender).
2. Railway/Render variables: `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## Where every file goes (explicit answer to "which files on which site")

| Files | Where | When |
|---|---|---|
| **entire repo** | **GitHub** | Phase 0 |
| nothing (uses your repo's `prisma/`) | **Supabase** — you only paste `DATABASE_URL`/`DIRECT_URL` into Railway/Render + run `migrate deploy` from your machine | Phase 1 |
| nothing (just returns a URL) | **Upstash** | Phase 2 |
| repo's `apps/api/**` + `prisma/schema.prisma` (platform builds from Root Directory `/apps/api`) | **Railway or Render** | Phase 3 |
| repo's `apps/web/**` (platform builds from Root Directory `apps/web`) | **Vercel** | Phase 4 |
| `NEXT_PUBLIC_*` values | Vercel project settings (never in git) | Phase 4 |
| `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, SMTP/Stripe keys | Railway/Render variables (never in git) | Phase 3/6 |
| nothing uploaded anywhere | `.env` stays on YOUR machine only, for local dev | — |

**Secrets never enter any git repo.** Platforms hold them as encrypted env vars.

---

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| Web deploys but "Network error" / API calls fail | `NEXT_PUBLIC_API_URL` missing/wrong at build → fix variable on Vercel → **Redeploy** |
| CORS error in browser console | API's `NEXT_PUBLIC_APP_URL`/`CORS_ORIGINS` don't match the Vercel URL → fix → redeploy API |
| API crashes at boot: `@prisma/client did not initialize yet` | postinstall didn't run → confirm Root Directory is `/apps/api` and Build Command runs `npm install` |
| `P1001 can't reach database` | `DATABASE_URL` uses the **direct** URL on Supabase → use the **pooler (6543)** URL for `DATABASE_URL` |
| Emails never arrive | No SMTP set (console-only mode) → check API logs for the link, or add Resend/Postmark vars (Phase 6) |
| Verification link goes to `http://localhost:3000/...` | API's `NEXT_PUBLIC_APP_URL` is unset/stale → set to the real Vercel URL → redeploy |
| Render API slow first request | Free tier sleeps → first hit wakes it (~30s); Socket.io auto-reconnects |
| Build fails on Vercel: `Module not found` | Root Directory not set to `apps/web` → set it → redeploy |
