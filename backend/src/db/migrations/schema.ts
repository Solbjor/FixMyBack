import { pgTable, foreignKey, check, uuid, text, integer, timestamp, unique, date, numeric, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const recommendations = pgTable("recommendations", {
	recommendationId: uuid("recommendation_id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	recommendationType: text("recommendation_type"),
	title: text().notNull(),
	description: text().notNull(),
	duration: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [postureSessions.sessionId],
			name: "recommendations_session_id_fkey"
		}).onDelete("cascade"),
	check("recommendations_recommendation_type_check", sql`recommendation_type = ANY (ARRAY['exercise'::text, 'habit'::text])`),
]);

export const progressSnapshots = pgTable("progress_snapshots", {
	snapshotId: uuid("snapshot_id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	snapshotDate: date("snapshot_date").notNull(),
	averageScore: numeric("average_score", { precision: 5, scale:  2 }),
	sessionsCount: integer("sessions_count").default(0).notNull(),
	improvementPercent: numeric("improvement_percent", { precision: 6, scale:  2 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "progress_snapshots_user_id_fkey"
		}).onDelete("cascade"),
	unique("progress_snapshots_user_id_snapshot_date_key").on(table.userId, table.snapshotDate),
]);

export const userSettings = pgTable("user_settings", {
	settingId: uuid("setting_id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	reminderEnabled: boolean("reminder_enabled").default(true).notNull(),
	reminderFrequency: integer("reminder_frequency"),
	preferredAlertType: text("preferred_alert_type"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "user_settings_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_settings_user_id_key").on(table.userId),
	check("user_settings_preferred_alert_type_check", sql`preferred_alert_type = ANY (ARRAY['vibrate'::text, 'sound'::text, 'both'::text])`),
]);

export const postureMetrics = pgTable("posture_metrics", {
	metricId: uuid("metric_id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	neckAngleDeg: numeric("neck_angle_deg", { precision: 6, scale:  2 }),
	shoulderTiltDeg: numeric("shoulder_tilt_deg", { precision: 6, scale:  2 }),
	hipTiltDeg: numeric("hip_tilt_deg", { precision: 6, scale:  2 }),
	spineAlignmentScore: numeric("spine_alignment_score", { precision: 5, scale:  2 }),
	headForwardDistanceCm: numeric("head_forward_distance_cm", { precision: 6, scale:  2 }),
	leftRightBalanceScore: numeric("left_right_balance_score", { precision: 5, scale:  2 }),
	confidenceScore: numeric("confidence_score", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [postureSessions.sessionId],
			name: "posture_metrics_session_id_fkey"
		}).onDelete("cascade"),
]);

export const postureAlerts = pgTable("posture_alerts", {
	alertId: uuid("alert_id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	alertType: text("alert_type").notNull(),
	severity: text(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [postureSessions.sessionId],
			name: "posture_alerts_session_id_fkey"
		}).onDelete("cascade"),
	check("posture_alerts_severity_check", sql`severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])`),
]);

export const users = pgTable("users", {
	userId: text("user_id").primaryKey().notNull(),
	fullName: text("full_name"),
	dateOfBirth: date("date_of_birth"),
	heightIn: numeric("height_in", { precision: 5, scale:  1 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const postureSessions = pgTable("posture_sessions", {
	sessionId: uuid("session_id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	sessionStart: timestamp("session_start", { mode: 'string' }).defaultNow().notNull(),
	sessionEnd: timestamp("session_end", { mode: 'string' }),
	overallScore: numeric("overall_score", { precision: 5, scale:  2 }),
	feedbackSummary: text("feedback_summary"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "posture_sessions_user_id_fkey"
		}).onDelete("cascade"),
]);
