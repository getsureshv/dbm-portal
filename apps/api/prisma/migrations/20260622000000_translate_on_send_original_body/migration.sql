-- Translate-on-send: store the pre-translation text + source language alongside
-- the displayed body. Additive, nullable, backward-compatible (no backfill).
-- Existing rows keep NULLs and render exactly as before.

-- AlterTable
ALTER TABLE "direct_messages" ADD COLUMN "original_body" TEXT,
ADD COLUMN "original_lang" TEXT;

-- AlterTable
ALTER TABLE "channel_messages" ADD COLUMN "original_body" TEXT,
ADD COLUMN "original_lang" TEXT;

-- AlterTable
ALTER TABLE "project_messages" ADD COLUMN "original_body" TEXT,
ADD COLUMN "original_lang" TEXT;
