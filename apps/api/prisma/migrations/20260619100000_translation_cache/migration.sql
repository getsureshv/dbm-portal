-- Persistent cache for inline message translations.
CREATE TABLE "translation_cache" (
    "id" UUID NOT NULL,
    "text_hash" TEXT NOT NULL,
    "target_lang" TEXT NOT NULL,
    "translated_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "translation_cache_text_hash_target_lang_key" ON "translation_cache"("text_hash", "target_lang");
