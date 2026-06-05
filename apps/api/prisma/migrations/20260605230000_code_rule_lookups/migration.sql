-- Dynamic code-rules cache: freshness marker per (jurisdiction, scope).
-- No enum touched, so the migration guard passes. Idempotent.
CREATE TABLE IF NOT EXISTS "code_rule_lookups" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "jurisdiction_id" UUID         NOT NULL,
  "scope"           TEXT         NOT NULL DEFAULT '',
  "last_synced_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ttl_seconds"     INTEGER      NOT NULL DEFAULT 604800,
  "source_url"      TEXT,
  "rule_count"      INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT "code_rule_lookups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "code_rule_lookups_jurisdiction_id_scope_key"
  ON "code_rule_lookups" ("jurisdiction_id", "scope");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'code_rule_lookups_jurisdiction_id_fkey'
  ) THEN
    ALTER TABLE "code_rule_lookups"
      ADD CONSTRAINT "code_rule_lookups_jurisdiction_id_fkey"
      FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
