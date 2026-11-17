-- ==============================================================================
-- 0005_p14_professor_ranks_and_history.sql: P14 Professor Ranks & Academic Archive History
-- Expand pattern: Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Add is_temporary to professors
ALTER TABLE "professors" ADD COLUMN IF NOT EXISTS "is_temporary" boolean DEFAULT false;

-- 2. Add professor_rank_snapshot to assignments
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "professor_rank_snapshot" varchar(50);

-- 3. Add professor_rank_snapshot to schedule_version_items
ALTER TABLE "schedule_version_items" ADD COLUMN IF NOT EXISTS "professor_rank_snapshot" varchar(50);

-- 4. Create professor_academic_profiles table
CREATE TABLE IF NOT EXISTS "professor_academic_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"professor_id" integer NOT NULL,
	"academic_year_id" integer,
	"academic_year" varchar(50) NOT NULL,
	"academic_rank" varchar(50) NOT NULL,
	"is_temporary" boolean DEFAULT false NOT NULL,
	"weekly_statutory_quota" integer DEFAULT 9,
	"department" varchar(255),
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_prof_academic_year" ON "professor_academic_profiles" ("professor_id", "academic_year");
CREATE INDEX IF NOT EXISTS "idx_prof_profiles_rank" ON "professor_academic_profiles" ("academic_rank");
CREATE INDEX IF NOT EXISTS "idx_prof_profiles_temp" ON "professor_academic_profiles" ("is_temporary");
