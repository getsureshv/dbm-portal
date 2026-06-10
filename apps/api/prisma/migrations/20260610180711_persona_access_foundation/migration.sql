-- CreateEnum
CREATE TYPE "PersonaBaseType" AS ENUM ('CLIENT', 'PROFESSIONAL', 'SUPPLIER', 'FREIGHT', 'SERVICE_PROVIDER', 'ADMIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PersonaStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'OWN', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "UserPersonaStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GranteeType" AS ENUM ('USER', 'PERSONA');

-- CreateEnum
CREATE TYPE "RecordGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- NOTE: Prisma also wanted to emit
--   ALTER TABLE "code_rule_lookups" ALTER COLUMN "id" DROP DEFAULT;
-- That is PRE-EXISTING drift: the hand-written 20260605230000 migration set a
-- DB-side gen_random_uuid() default while the model uses app-side @default(uuid()).
-- It is unrelated to this module and harmless (ids are always supplied by Prisma),
-- so it is intentionally omitted here to keep this migration purely additive and
-- avoid touching an existing live table.

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "base_type" "PersonaBaseType" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "PersonaStatus" NOT NULL DEFAULT 'ACTIVE',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_permissions" (
    "id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "entity_key" TEXT NOT NULL,
    "actions" TEXT[],
    "scope" "PermissionScope" NOT NULL DEFAULT 'OWN',

    CONSTRAINT "persona_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "actions" TEXT[],
    "supports_record_grants" BOOLEAN NOT NULL DEFAULT true,
    "owner_field" TEXT,
    "participant_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_personas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "status" "UserPersonaStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "user_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_grants" (
    "id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "grantee_type" "GranteeType" NOT NULL,
    "grantee_id" UUID NOT NULL,
    "actions" TEXT[],
    "reason" TEXT NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "status" "RecordGrantStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "record_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_slug_key" ON "personas"("slug");

-- CreateIndex
CREATE INDEX "personas_status_idx" ON "personas"("status");

-- CreateIndex
CREATE INDEX "persona_permissions_entity_key_idx" ON "persona_permissions"("entity_key");

-- CreateIndex
CREATE UNIQUE INDEX "persona_permissions_persona_id_entity_key_key" ON "persona_permissions"("persona_id", "entity_key");

-- CreateIndex
CREATE INDEX "user_personas_user_id_status_idx" ON "user_personas"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_personas_user_id_persona_id_key" ON "user_personas"("user_id", "persona_id");

-- CreateIndex
CREATE INDEX "record_grants_entity_record_id_status_idx" ON "record_grants"("entity", "record_id", "status");

-- CreateIndex
CREATE INDEX "record_grants_grantee_type_grantee_id_status_idx" ON "record_grants"("grantee_type", "grantee_id", "status");

-- CreateIndex
CREATE INDEX "permission_audit_log_actor_id_idx" ON "permission_audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "permission_audit_log_subject_type_subject_id_idx" ON "permission_audit_log"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "permission_audit_log_at_idx" ON "permission_audit_log"("at");

-- AddForeignKey
ALTER TABLE "persona_permissions" ADD CONSTRAINT "persona_permissions_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_permissions" ADD CONSTRAINT "persona_permissions_entity_key_fkey" FOREIGN KEY ("entity_key") REFERENCES "entities"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
