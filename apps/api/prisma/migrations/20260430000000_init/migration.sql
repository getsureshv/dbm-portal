-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('PROFESSIONAL', 'SUPPLIER', 'FREIGHT');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'NONE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'NEW_BUILD');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DISCOVERY', 'BIDDING', 'CONTRACTING', 'EXECUTION', 'CLOSING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScopeStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETE', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ScopeCreationMode" AS ENUM ('AI_ASSISTED', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LEGAL', 'FINANCIAL', 'TECHNICAL', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "TradeGroup" AS ENUM ('PLANNING_DESIGN', 'CONTRACTORS', 'SUPPLIERS', 'SERVICES');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmittalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "role" "UserRole",
    "provider_type" "ProviderType",
    "name" TEXT,
    "phone" TEXT,
    "language_preference" TEXT NOT NULL DEFAULT 'en',
    "verification_status" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_number_1" TEXT NOT NULL,
    "contact_number_2" TEXT,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "address" JSONB,
    "years_in_profession" INTEGER,
    "years_in_business" INTEGER,
    "license_number" TEXT,
    "license_status" "LicenseStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "style_of_work" TEXT[],
    "awards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "portfolio_key" TEXT,
    "profile_image_key" TEXT,
    "insurance_cert_key" TEXT,
    "trade_category_id" UUID,
    "trade_name_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_number_1" TEXT NOT NULL,
    "contact_number_2" TEXT,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "address" JSONB,
    "material_types" TEXT[],
    "services_provided" TEXT[],
    "multiple_locations" BOOLEAN NOT NULL DEFAULT false,
    "secondary_addresses" JSONB,
    "license_status" "LicenseStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "profile_image_key" TEXT,
    "portfolio_key" TEXT,
    "trade_category_id" UUID,
    "trade_name_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_number_1" TEXT NOT NULL,
    "contact_number_2" TEXT,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "address" JSONB,
    "service_types" TEXT[],
    "services_provided" TEXT[],
    "multiple_locations" BOOLEAN NOT NULL DEFAULT false,
    "secondary_addresses" JSONB,
    "license_status" "LicenseStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "profile_image_key" TEXT,
    "portfolio_key" TEXT,
    "trade_category_id" UUID,
    "trade_name_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_categories" (
    "id" UUID NOT NULL,
    "name" "TradeGroup" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "trade_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_names" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "trade_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DISCOVERY',
    "zip_code" TEXT NOT NULL,
    "description" TEXT,
    "scope_creation_mode" "ScopeCreationMode" NOT NULL DEFAULT 'AI_ASSISTED',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'TECHNICAL',
    "filename" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "extracted_text" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "ScopeStatus" NOT NULL DEFAULT 'DRAFT',
    "completeness_percent" INTEGER NOT NULL DEFAULT 0,
    "pdf_s3_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_scope" TEXT,
    "dimensions" TEXT,
    "material_grade" TEXT,
    "timeline" TEXT,
    "milestones" TEXT,
    "special_conditions" TEXT,
    "preferred_start_date" TEXT,
    "site_constraints" TEXT,
    "aesthetic_preferences" TEXT,

    CONSTRAINT "scope_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_interview_turns" (
    "id" UUID NOT NULL,
    "scope_document_id" UUID NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT,
    "field_populated" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_interview_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "impact_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "RfiStatus" NOT NULL DEFAULT 'OPEN',
    "question" TEXT,
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittals" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "SubmittalStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "s3_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "vendor" TEXT,
    "items" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "percent_done" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_user_id_key" ON "professional_profiles"("user_id");

-- CreateIndex
CREATE INDEX "professional_profiles_trade_category_id_idx" ON "professional_profiles"("trade_category_id");

-- CreateIndex
CREATE INDEX "professional_profiles_trade_name_id_idx" ON "professional_profiles"("trade_name_id");

-- CreateIndex
CREATE INDEX "professional_profiles_license_status_idx" ON "professional_profiles"("license_status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_user_id_key" ON "supplier_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "freight_profiles_user_id_key" ON "freight_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_categories_name_key" ON "trade_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "trade_names_slug_key" ON "trade_names"("slug");

-- CreateIndex
CREATE INDEX "trade_names_category_id_idx" ON "trade_names"("category_id");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "projects_zip_code_idx" ON "projects"("zip_code");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "project_documents_project_id_idx" ON "project_documents"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "scope_documents_project_id_key" ON "scope_documents"("project_id");

-- CreateIndex
CREATE INDEX "scope_interview_turns_scope_document_id_idx" ON "scope_interview_turns"("scope_document_id");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_user_id_idx" ON "feature_flags"("key", "user_id");

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_trade_category_id_fkey" FOREIGN KEY ("trade_category_id") REFERENCES "trade_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_trade_name_id_fkey" FOREIGN KEY ("trade_name_id") REFERENCES "trade_names"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_trade_category_id_fkey" FOREIGN KEY ("trade_category_id") REFERENCES "trade_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_trade_name_id_fkey" FOREIGN KEY ("trade_name_id") REFERENCES "trade_names"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_profiles" ADD CONSTRAINT "freight_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_profiles" ADD CONSTRAINT "freight_profiles_trade_category_id_fkey" FOREIGN KEY ("trade_category_id") REFERENCES "trade_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_profiles" ADD CONSTRAINT "freight_profiles_trade_name_id_fkey" FOREIGN KEY ("trade_name_id") REFERENCES "trade_names"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_names" ADD CONSTRAINT "trade_names_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "trade_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_documents" ADD CONSTRAINT "scope_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_interview_turns" ADD CONSTRAINT "scope_interview_turns_scope_document_id_fkey" FOREIGN KEY ("scope_document_id") REFERENCES "scope_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_reports" ADD CONSTRAINT "delivery_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

