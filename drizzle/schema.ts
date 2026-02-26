import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * LINE users - stores LINE user IDs for push notifications
 */
export const lineUsers = mysqlTable("line_users", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineUser = typeof lineUsers.$inferSelect;
export type InsertLineUser = typeof lineUsers.$inferInsert;

/**
 * Messages - stores all incoming/outgoing messages with category classification
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
  content: text("content").notNull(),
  category: mysqlEnum("category", ["investment", "ai", "slide_project", "idea", "general"]).default("general"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * News deliveries - tracks economic news push notifications sent
 */
export const newsDeliveries = mysqlTable("news_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  topic: mysqlEnum("topic", ["gold_xauusd", "gbpjpy", "combined", "morning_briefing"]).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type NewsDelivery = typeof newsDeliveries.$inferSelect;
export type InsertNewsDelivery = typeof newsDeliveries.$inferInsert;

/**
 * Reminders - configurable reminder schedules
 */
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["x_post", "slide_creation", "custom"]).notNull(),
  message: text("message").notNull(),
  cronExpression: varchar("cronExpression", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastSentAt: timestamp("lastSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

/**
 * Generated content - stores AI-generated content (X posts, infographics)
 */
export const generatedContent = mysqlTable("generated_content", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["x_post", "infographic", "news_summary", "summary"]).notNull(),
  topic: varchar("topic", { length: 255 }),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "posted"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type InsertGeneratedContent = typeof generatedContent.$inferInsert;