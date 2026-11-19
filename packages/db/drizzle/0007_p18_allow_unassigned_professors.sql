-- ==============================================================================
-- 0007_p18_allow_unassigned_professors.sql: Support Scheduling Without Assigned Professors
-- Expand pattern: Make professor_id nullable in schedule_version_items and assignments
-- ==============================================================================

ALTER TABLE "schedule_version_items" ALTER COLUMN "professor_id" DROP NOT NULL;
ALTER TABLE "assignments" ALTER COLUMN "professor_id" DROP NOT NULL;
