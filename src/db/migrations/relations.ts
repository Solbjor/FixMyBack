import { relations } from "drizzle-orm/relations";
import { postureSessions, recommendations, users, progressSnapshots, userSettings, postureMetrics, postureAlerts } from "./schema";

export const recommendationsRelations = relations(recommendations, ({one}) => ({
	postureSession: one(postureSessions, {
		fields: [recommendations.sessionId],
		references: [postureSessions.sessionId]
	}),
}));

export const postureSessionsRelations = relations(postureSessions, ({one, many}) => ({
	recommendations: many(recommendations),
	user: one(users, {
		fields: [postureSessions.userId],
		references: [users.userId]
	}),
	postureMetrics: many(postureMetrics),
	postureAlerts: many(postureAlerts),
}));

export const progressSnapshotsRelations = relations(progressSnapshots, ({one}) => ({
	user: one(users, {
		fields: [progressSnapshots.userId],
		references: [users.userId]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	progressSnapshots: many(progressSnapshots),
	userSettings: many(userSettings),
	postureSessions: many(postureSessions),
}));

export const userSettingsRelations = relations(userSettings, ({one}) => ({
	user: one(users, {
		fields: [userSettings.userId],
		references: [users.userId]
	}),
}));

export const postureMetricsRelations = relations(postureMetrics, ({one}) => ({
	postureSession: one(postureSessions, {
		fields: [postureMetrics.sessionId],
		references: [postureSessions.sessionId]
	}),
}));

export const postureAlertsRelations = relations(postureAlerts, ({one}) => ({
	postureSession: one(postureSessions, {
		fields: [postureAlerts.sessionId],
		references: [postureSessions.sessionId]
	}),
}));