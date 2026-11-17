-- ==============================================================================
-- 0004_p13_auto_scheduler_and_versions.sql: P13 Auto-Scheduler & Approval Workflow
-- Expand pattern: Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Schedule Versions table
CREATE TABLE IF NOT EXISTS "schedule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"title" text DEFAULT '',
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"note" text DEFAULT '',
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"published_at" timestamp,
	"metrics" text DEFAULT '{}',
	"critical_conflicts_count" integer DEFAULT 0,
	"total_sessions_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_schedule_versions_sem_ver" ON "schedule_versions" ("semester_id", "version_number");
CREATE INDEX IF NOT EXISTS "idx_schedule_versions_status" ON "schedule_versions" ("status");
CREATE INDEX IF NOT EXISTS "idx_schedule_versions_created" ON "schedule_versions" ("created_at");

-- 2. Schedule Version Items table (per-session detail)
CREATE TABLE IF NOT EXISTS "schedule_version_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_version_id" integer NOT NULL,
	"assignment_id" integer,
	"course_id" integer NOT NULL,
	"professor_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"session_type" text DEFAULT 'lecture',
	"item_status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"note" text DEFAULT '',
	"metadata" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ver_items_version_id" ON "schedule_version_items" ("schedule_version_id");
CREATE INDEX IF NOT EXISTS "idx_ver_items_prof_slot" ON "schedule_version_items" ("professor_id", "day_of_week", "start_time");
CREATE INDEX IF NOT EXISTS "idx_ver_items_group_slot" ON "schedule_version_items" ("group_id", "day_of_week", "start_time");
CREATE INDEX IF NOT EXISTS "idx_ver_items_room_slot" ON "schedule_version_items" ("room_id", "day_of_week", "start_time");
