-- Add per-person "working on it" start signal to task assignments.
ALTER TABLE "task_assignments" ADD COLUMN "started_at" TIMESTAMP(3);

-- Backfill: any already-completed part was, by definition, started.
UPDATE "task_assignments" SET "started_at" = "completed_at" WHERE "completed_at" IS NOT NULL;
