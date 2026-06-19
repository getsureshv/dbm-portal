-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('image', 'video', 'audio', 'file');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "direct_message_id" UUID,
    "channel_message_id" UUID,
    "project_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_uploader_id_idx" ON "attachments"("uploader_id");

-- CreateIndex
CREATE INDEX "attachments_direct_message_id_idx" ON "attachments"("direct_message_id");

-- CreateIndex
CREATE INDEX "attachments_channel_message_id_idx" ON "attachments"("channel_message_id");

-- CreateIndex
CREATE INDEX "attachments_project_message_id_idx" ON "attachments"("project_message_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_direct_message_id_fkey" FOREIGN KEY ("direct_message_id") REFERENCES "direct_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_channel_message_id_fkey" FOREIGN KEY ("channel_message_id") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_message_id_fkey" FOREIGN KEY ("project_message_id") REFERENCES "project_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
