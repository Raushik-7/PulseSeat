-- Sync schema drift: columns added via local `db push` after the init migration
-- (email-verification auth rewrite + event media fields). Supabase production
-- never received these; this migration brings every environment to the schema.
-- Diff-generated with: prisma migrate diff --from-migrations --to-schema-datamodel
-- and hardened with IF NOT EXISTS so partially-drifted databases don't fail.

-- AlterTable
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "gallery_urls" TEXT[];
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "highlights" TEXT[];
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "short_description" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires_at" TIMESTAMP(3);
