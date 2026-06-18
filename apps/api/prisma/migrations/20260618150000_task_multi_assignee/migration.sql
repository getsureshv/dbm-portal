-- CreateTable: task_assignments
CREATE TABLE "task_assignments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_task_id_user_id_key" ON "task_assignments"("task_id", "user_id");
CREATE INDEX "task_assignments_task_id_idx" ON "task_assignments"("task_id");
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: create a TaskAssignment row for every existing task that has a legacy assignee.
-- completed_at mirrors the task's completion when the task is already DONE.
INSERT INTO "task_assignments" ("id", "task_id", "user_id", "completed_at", "created_at")
SELECT
    gen_random_uuid(),
    "id",
    "assignee_id",
    CASE WHEN "status" = 'DONE' THEN COALESCE("completed_at", CURRENT_TIMESTAMP) ELSE NULL END,
    CURRENT_TIMESTAMP
FROM "tasks"
WHERE "assignee_id" IS NOT NULL;
