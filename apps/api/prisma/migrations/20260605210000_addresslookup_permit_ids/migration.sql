-- Cache fix: track which permits each address lookup returned, so cached reads
-- don't depend on matching Permit.address (which strands zip-scoped vendors at 0).
ALTER TABLE "address_lookups"
  ADD COLUMN IF NOT EXISTS "permit_external_ids" TEXT[] NOT NULL DEFAULT '{}';
