-- ==============================================================================
-- 0006_p16_curriculum_and_module_guide.sql: P16 Curriculum Mapping & Module Guide
-- Expand pattern: Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Add curriculum columns to courses table
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "semester" varchar(10) DEFAULT 'S1';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "specialization_id" integer;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "credits" integer DEFAULT 3;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "coefficient" integer DEFAULT 2;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "has_lecture" boolean DEFAULT true;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "has_td" boolean DEFAULT true;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "has_tp" boolean DEFAULT false;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "study_level" varchar(50) DEFAULT 'L1';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "weekly_hours" numeric(4, 2) DEFAULT 3.00;

-- 2. Create course_specializations junction table for shared / multi-specialization courses
CREATE TABLE IF NOT EXISTS "course_specializations" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"specialization_id" integer NOT NULL,
	"semester" varchar(10) DEFAULT 'S1',
	"academic_year_id" integer,
	"is_core" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_course_spec_sem" ON "course_specializations" ("course_id", "specialization_id", "semester");
CREATE INDEX IF NOT EXISTS "idx_course_spec_course" ON "course_specializations" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_spec_specialization" ON "course_specializations" ("specialization_id");
