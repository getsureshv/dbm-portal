-- Record Access search scalability (PR: persona-access)
-- Adds indexes so the admin Record Access picker scales to thousands of projects.
--
--  * pg_trgm GIN index on projects.title powers fast case-insensitive
--    substring search (ILIKE '%fragment%') used by listRecords.
--  * btree index on (type) supports the type filter / enum-prefix match.
--  * composite btree on (created_at, id) backs the keyset pagination ordering
--    (ORDER BY created_at DESC, id DESC) so every page stays fast and stable.

-- Trigram extension for substring search on title.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index for ILIKE '%...%' on title.
CREATE INDEX IF NOT EXISTS "projects_title_trgm_idx"
  ON "projects" USING gin ("title" gin_trgm_ops);

-- Btree index on type for the type filter.
CREATE INDEX IF NOT EXISTS "projects_type_idx" ON "projects" ("type");

-- Composite index backing keyset pagination ordering.
CREATE INDEX IF NOT EXISTS "projects_created_at_id_idx"
  ON "projects" ("created_at", "id");
