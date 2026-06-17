-- Project contacts capture
--  * Adds optional project site address columns (street/city/state) to projects.
--    The ZIP continues to live in projects.zip_code.
--  * Adds project_companies: a project can have many companies, each with a
--    primary contact person and that person's role in the project.

-- Optional project address columns.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "address_street" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "address_city" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "address_state" TEXT;

-- Company + contact + role rows, one-to-many under a project.
CREATE TABLE IF NOT EXISTS "project_companies" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_website" TEXT,
    "company_phone" TEXT,
    "contact_first_name" TEXT,
    "contact_last_name" TEXT,
    "contact_title" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "role_in_project" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_companies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_companies_project_id_idx"
    ON "project_companies" ("project_id");

ALTER TABLE "project_companies"
    ADD CONSTRAINT "project_companies_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
