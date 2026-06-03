-- City Integration: Dallas + Flower Mound demo
-- Adds Jurisdiction, Permit, CodeRule, AddressLookup + supporting enums.

-- CreateEnum
CREATE TYPE "JurisdictionVendor" AS ENUM ('ACCELA', 'SHOVELS', 'ETRAKIT', 'ILMS', 'MOCK');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('OPEN', 'ISSUED', 'FINALIZED', 'EXPIRED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CodeFamily" AS ENUM ('IBC', 'IRC', 'IECC', 'IPC', 'IMC', 'NEC', 'LOCAL');

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "slug" TEXT NOT NULL,
    "fips" TEXT,
    "vendor" "JurisdictionVendor" NOT NULL,
    "has_zoning" BOOLEAN NOT NULL DEFAULT true,
    "adapter_config" JSONB,
    "zip_prefixes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permits" (
    "id" UUID NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" TEXT,
    "status" "PermitStatus" NOT NULL DEFAULT 'UNKNOWN',
    "issued_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "contractor" TEXT,
    "valuation" DECIMAL(14,2),
    "description" TEXT,
    "raw" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_rules" (
    "id" UUID NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "code_family" "CodeFamily" NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scope_tags" TEXT[],
    "effective_date" TIMESTAMP(3),
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_lookups" (
    "id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttl_seconds" INTEGER NOT NULL DEFAULT 86400,

    CONSTRAINT "address_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_slug_key" ON "jurisdictions"("slug");
CREATE INDEX "jurisdictions_state_idx" ON "jurisdictions"("state");

-- CreateIndex
CREATE INDEX "permits_address_idx" ON "permits"("address");
CREATE UNIQUE INDEX "permits_jurisdiction_id_external_id_key" ON "permits"("jurisdiction_id", "external_id");

-- CreateIndex
CREATE INDEX "code_rules_jurisdiction_id_scope_tags_idx" ON "code_rules"("jurisdiction_id", "scope_tags");
CREATE UNIQUE INDEX "code_rules_jurisdiction_id_code_family_section_key" ON "code_rules"("jurisdiction_id", "code_family", "section");

-- CreateIndex
CREATE UNIQUE INDEX "address_lookups_address_jurisdiction_id_key" ON "address_lookups"("address", "jurisdiction_id");

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_rules" ADD CONSTRAINT "code_rules_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_lookups" ADD CONSTRAINT "address_lookups_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
