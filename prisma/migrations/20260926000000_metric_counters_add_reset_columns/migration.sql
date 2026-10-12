-- ─── Booking metrics table + user reset-token columns ─────────────────────
--
-- Part 1: `metric_counters` — Postgres-backed booking funnel counters that
-- replace the per-booking Redis INCRs (see apps/api/src/plugins/booking-metrics.ts).
-- Zero Redis commands for metrics; survives Redis restarts/outages.
--
-- Part 2: `users.reset_token_hash` / `users.reset_token_expires_at` —
-- Postgres fallback for password-reset (and, reused, email-verification)
-- tokens when Redis is unavailable, so users can never be locked out of
-- account recovery by a cache outage.
--
-- Both statements are IF NOT EXISTS-guarded: safe to run even when the earlier
-- drift migration already added the columns (e.g. local databases that
-- recorded 20260924000000 before these lines were appended there).

CREATE TABLE IF NOT EXISTS "metric_counters" (
  "metric"     TEXT PRIMARY KEY,
  "n"          INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires_at" TIMESTAMP(3);
