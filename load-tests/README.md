# PulseSeat Load Tests (k6)

Real k6 load tests for the PulseSeat ticket-booking API. These scripts were used to
produce `PULSESEAT_LOAD_TEST_REPORT.md` — every number in that report comes from
actually running them.

## Prerequisites

- **k6** — installed locally in `tools/k6-v2.3.0-windows-amd64/k6.exe` (no admin needed):
  ```bash
  K6="D:/PulseSeat/tools/k6-v2.3.0-windows-amd64/k6.exe"
  "$K6" version
  ```
- **PostgreSQL + Redis** running (Docker: `docker compose up -d postgres redis`).
  On this machine Docker Postgres maps to host port **5433** (native Windows
  Postgres owns 5432).
- **API running** — see "Starting the API for load tests" below.
- **Seeded database** — includes 600 verified load-test users
  (`load0..load599@loadtest.local` / `LoadTest123!`) created by `prisma/seed.ts`.

## Environment variables

| Variable            | Default                 | Purpose                                    |
|---------------------|-------------------------|--------------------------------------------|
| `K6_BASE_URL`       | `http://localhost:3001` | API base URL                               |
| `K6_LOAD_PASSWORD`  | `LoadTest123!`          | password for seeded load-test users        |
| `STAGE`             | `100`                   | VU target for `browse.js`                  |
| `DURATION`          | `60s`                   | hold time for `browse.js`                  |
| `MODE`              | `contention`            | `contention` (race for same seat) or `flow`|
| `VUS`               | `100`                   | VUs for `booking.js`                       |
| `POOL`              | `20`                    | seat-pool size in contention mode          |
| `MAX_VUS`           | `5000`                  | top stage for `full-load.js`               |
| `SUSTAIN`           | `2m`                    | hold time per stage for `full-load.js`     |

## Starting the API for load tests

The default `RATE_LIMIT_GENERAL=100` (per IP per minute) would throttle k6,
which sends all traffic from one IP. For test runs start the API with a raised
limit (test-only override, not committed to `.env`):

```bash
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'D:\PulseSeat\node_modules\.pnpm\tsx@4.23.12\node_modules\tsx\dist\cli.mjs','--env-file=../../.env','src/server.ts' -WorkingDirectory 'D:\PulseSeat\apps\api' -WindowStyle Hidden -PassThru"
```

For a normal dev session keep using `.freebuff/start-api.ps1` (which sets no
override). Restarting the API without the override restores the 100 req/min dev
limit.

## Running the tests

```bash
K6="D:/PulseSeat/tools/k6-v2.3.0-windows-amd64/k6.exe"

# 0. Pre-flight check (API reachable, test event resolved)
"$K6" run load-tests/health-check.js

# 1. Mixed read traffic at a single stage (e.g. 500 VUs for 60s)
"$K6" run load-tests/browse.js -e STAGE=500 -e DURATION=60s --summary-export=results/stage-500.json

# 2. Concurrent booking — contention (100 VUs race for the SAME seat)
"$K6" run load-tests/booking.js -e MODE=contention -e VUS=100 -e POOL=20 \
    --summary-export=results/booking-contention.json

# 2b. Concurrent booking — flow (unique seats, throughput)
"$K6" run load-tests/booking.js -e MODE=flow -e VUS=50 --summary-export=results/booking-flow.json

# 3. Full staged ramp: 100 → 500 → 1,000 → 2,500 → 5,000 VUs
"$K6" run load-tests/full-load.js --summary-export=results/full-load.json
```

## Test data & safety

- Bookings created by these tests use the **mock payment provider** — no real
  payment gateway is touched.
- **No SMTP** is configured in the dev environment, so booking-confirmation
  emails are logged, not sent.
- Tests only book seats on the **existing seeded events** (no destructive
  writes). To restore pristine seat state afterwards, re-seed:
  ```bash
  cd prisma && DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pulseseat" npx tsx seed.ts
  ```
- `results/` holds raw k6 JSON summaries — the report cites them directly.

## Interpreting results

- `http_req_duration` percentiles (p50/p95/p99) are in **milliseconds**.
- `booking_success` / `booking_conflict` are custom Rates: in contention mode
  exactly `POOL` VUs should succeed and the rest must get 409 — that's the
  double-booking protection working.
- `scenario_errors` counts failed checks (non-200s on read endpoints).
- `vus_max` confirms the peak concurrency actually reached.
