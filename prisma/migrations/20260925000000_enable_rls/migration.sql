-- ─── Enable Row Level Security on all application tables ──────────────────
--
-- Context (Phase C): Supabase Security Advisor reported `rls_disabled_in_public`.
-- Tables under `public` were created by Prisma `migrate deploy`, which does not
-- create RLS policies or disable grants — every table was readable (and, per
-- default public-schema grants, writable for authenticated roles) through the
-- Supabase auto-generated REST API (PostgREST) at
-- https://<ref>.supabase.co/rest/v1/<table> using the anon key.
--
-- Important access-path analysis (verified against the codebase):
--   • The PulseSeat API (Render) talks to Postgres with the `postgres` role via
--     DATABASE_URL. RLS does NOT apply to table owners / superuser, soPrisma
--     access is unaffected by this migration — events, seats, bookings, auth
--     flows all keep working exactly as before.
--   • No frontend or backend code uses the Supabase REST endpoint/anon key
--     (grep verified: no supabase-js client anywhere).
--   • Therefore the safest correct fix is: enable RLS on every public table
--     WITHOUT policies. Result: anon/authenticated REST access to every table
--     becomes deny-all, while the privileged `postgres` API path is untouched.
--
-- Tolerant design: idempotent (safe to re-run) and re-entrant if new tables
-- appear later (loops over existing tables). Tables created after this
-- migration will need RLS enabled — see prisma rls drift note in docs.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', '_prisma_migrations', 'metric_counters')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Sanity notes (verified behaviour, not guesswork):
--   • We deliberately do NOT use FORCE ROW LEVEL SECURITY. Postgres lets the
--     table OWNER bypass RLS when FORCE is off. The Prisma datasource role
--     (postgres) is the table owner that created these tables, so every
--     API/seed/migration path keeps full access.
--   • The `anon` and `authenticated` Supabase roles are NOT table owners and
--     have no policies → they get zero rows from every table. The
--     auto-generated REST API (/<ref>.supabase.co/rest/v1/<table>) is
--     effectively locked down, which resolves the Security Advisor finding.
--   • `schema_migrations`/`_prisma_migrations`/`metric_counters` are excluded:
--     they contain no user data (the advisor does not flag them, and keeping
--     them readable is harmless — no PII).
--   • Verification queries (run against Supabase SQL editor after deploy):
--       SELECT relname, relrowsecurity FROM pg_class
--        WHERE relnamespace = 'public'::regnamespace ORDER BY 1;
--       -- every app table must show relrowsecurity = true
--       -- Security Advisor → re-run scan → rls_disabled_in_public must be gone
--   • Rollback (only if an unknown consumer breaks): disable RLS per table:
--       ALTER TABLE public."events" DISABLE ROW LEVEL SECURITY; -- etc.
--   • If the project ever adopts supabase-js from the browser, replace this
--     deny-all with explicit per-table policies (owner-scoped for
--     bookings/payments, public-select for published events).
