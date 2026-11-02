-- ==============================================================================
-- 0003_p8_api_v1_idempotency.sql: P8 API v1 Idempotency & Shadow Route Diff Store
-- Expand pattern: Safe, additive-only migration. Never drops columns or tables.
-- ==============================================================================

-- 1. Idempotency Keys table for safe retries and deduplication
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_idempotency_expires" ON "idempotency_keys" ("expires_at");

-- 2. API Diff Report table for Shadow comparison and compatibility tracking
CREATE TABLE IF NOT EXISTS "api_diff_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_name" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"legacy_status" integer NOT NULL,
	"v1_status" integer NOT NULL,
	"diff_summary" text,
	"trace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_api_diff_route" ON "api_diff_report" ("route_name");
CREATE INDEX IF NOT EXISTS "idx_api_diff_created" ON "api_diff_report" ("created_at");

