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
 * Memos - stores user's raw memos (facts/observations)
 */
export const memos = mysqlTable("memos", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(),
  factContent: text("factContent").notNull(), // Raw memo input
  status: mysqlEnum("status", ["draft", "categorizing", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Memo = typeof memos.$inferSelect;
export type InsertMemo = typeof memos.$inferInsert;

/**
 * Categorizations - stores the user's abstraction/concrete/transfer categorization
 */
export const categorizations = mysqlTable("categorizations", {
  id: int("id").autoincrement().primaryKey(),
  memoId: int("memoId").notNull(),
  abstractionInput: text("abstractionInput"), // User's abstraction
  concreteInput: text("concreteInput"), // User's concrete example
  transferInput: text("transferInput"), // User's transfer/application
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Categorization = typeof categorizations.$inferSelect;
export type InsertCategorization = typeof categorizations.$inferInsert;

/**
 * Analysis results - stores Maeda Yuji's perspective analysis
 */
export const analysisResults = mysqlTable("analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  memoId: int("memoId").notNull(),
  maedaAbstraction: text("maedaAbstraction"), // Maeda's view on abstraction
  maedaConcrete: text("maedaConcrete"), // Maeda's concrete example
  maedaTransfer: text("maedaTransfer"), // Maeda's transfer suggestion
  maedaInsight: text("maedaInsight"), // Maeda's unique insight
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;

/**
 * Messages - stores all incoming/outgoing messages (for LINE interaction history)
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["memo_input", "workflow_step", "analysis_result", "notification"]).default("memo_input"),
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
  type: mysqlEnum("type", ["memo_reminder", "shiwake_prompt", "custom"]).notNull(),
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