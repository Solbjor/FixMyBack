-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"password_hash" text NOT NULL,
	"date_of_birth" date,
	"height_in" numeric(5, 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"recommendation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"recommendation_type" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_recommendation_type_check" CHECK (recommendation_type = ANY (ARRAY['exercise'::text, 'habit'::text]))
);
--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"average_score" numeric(5, 2),
	"sessions_count" integer DEFAULT 0 NOT NULL,
	"improvement_percent" numeric(6, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_snapshots_user_id_snapshot_date_key" UNIQUE("user_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"setting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"reminder_frequency" integer,
	"preferred_alert_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "user_settings_preferred_alert_type_check" CHECK (preferred_alert_type = ANY (ARRAY['vibrate'::text, 'sound'::text, 'both'::text]))
);
--> statement-breakpoint
CREATE TABLE "posture_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_start" timestamp DEFAULT now() NOT NULL,
	"session_end" timestamp,
	"overall_score" numeric(5, 2),
	"feedback_summary" text
);
--> statement-breakpoint
CREATE TABLE "posture_metrics" (
	"metric_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"neck_angle_deg" numeric(6, 2),
	"shoulder_tilt_deg" numeric(6, 2),
	"hip_tilt_deg" numeric(6, 2),
	"spine_alignment_score" numeric(5, 2),
	"head_forward_distance_cm" numeric(6, 2),
	"left_right_balance_score" numeric(5, 2),
	"confidence_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posture_alerts" (
	"alert_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posture_alerts_severity_check" CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))
);
--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."posture_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posture_sessions" ADD CONSTRAINT "posture_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posture_metrics" ADD CONSTRAINT "posture_metrics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."posture_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posture_alerts" ADD CONSTRAINT "posture_alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."posture_sessions"("session_id") ON DELETE cascade ON UPDATE no action;
*/