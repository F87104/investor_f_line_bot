import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  lineUsers, InsertLineUser,
  messages, InsertMessage,
  memos, InsertMemo, Memo,
  categorizations, InsertCategorization, Categorization,
  analysisResults, InsertAnalysisResult, AnalysisResult,
  newsDeliveries, InsertNewsDelivery,
  reminders, InsertReminder,
  generatedContent, InsertGeneratedContent,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── LINE User helpers ───
export async function upsertLineUser(lineUserId: string, displayName?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lineUsers).values({ lineUserId, displayName: displayName ?? null })
    .onDuplicateKeyUpdate({ set: { displayName: displayName ?? sql`displayName`, updatedAt: new Date() } });
}

export async function getActiveLineUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineUsers).where(eq(lineUsers.isActive, true));
}

export async function getAllLineUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineUsers).orderBy(desc(lineUsers.createdAt));
}

// ─── Message helpers ───
export async function saveMessage(msg: InsertMessage) {
  const db = await getDb();
  if (!db) return;
  await db.insert(messages).values(msg);
}

export async function getMessages(limit = 50, messageType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (messageType && messageType !== "all") {
    return db.select().from(messages)
      .where(eq(messages.messageType, messageType as any))
      .orderBy(desc(messages.createdAt)).limit(limit);
  }
  return db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function getMessagesByType() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    messageType: messages.messageType,
    count: sql<number>`count(*)`,
  }).from(messages).groupBy(messages.messageType);
}

// ─── News Delivery helpers ───
export async function saveNewsDelivery(delivery: InsertNewsDelivery) {
  const db = await getDb();
  if (!db) return;
  await db.insert(newsDeliveries).values(delivery);
}

export async function getRecentNewsDeliveries(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(newsDeliveries).orderBy(desc(newsDeliveries.sentAt)).limit(limit);
}

// ─── Reminder helpers ───
export async function getActiveReminders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reminders).where(eq(reminders.isActive, true));
}

export async function getAllReminders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reminders).orderBy(desc(reminders.createdAt));
}

export async function createReminder(reminder: InsertReminder) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reminders).values(reminder);
}

export async function updateReminderStatus(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(reminders).set({ isActive }).where(eq(reminders.id, id));
}

export async function deleteReminder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reminders).where(eq(reminders.id, id));
}

export async function updateReminderLastSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(reminders).set({ lastSentAt: new Date() }).where(eq(reminders.id, id));
}

// ─── Generated Content helpers ───
export async function saveGeneratedContent(content: InsertGeneratedContent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(generatedContent).values(content);
}

export async function getGeneratedContent(type?: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  if (type) {
    return db.select().from(generatedContent)
      .where(eq(generatedContent.type, type as any))
      .orderBy(desc(generatedContent.createdAt)).limit(limit);
  }
  return db.select().from(generatedContent).orderBy(desc(generatedContent.createdAt)).limit(limit);
}

export async function updateContentStatus(id: number, status: "draft" | "approved" | "posted") {
  const db = await getDb();
  if (!db) return;
  await db.update(generatedContent).set({ status }).where(eq(generatedContent.id, id));
}

// ─── Memo helpers ───
export async function createMemo(memo: InsertMemo): Promise<Memo | null> {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(memos).values(memo).$returningId();
  const id = inserted[0]?.id;
  if (id === undefined) return null;
  const created = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  return created[0] || null;
}

export async function getMemos(lineUserId: string, limit = 20): Promise<Memo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memos)
    .where(eq(memos.lineUserId, lineUserId))
    .orderBy(desc(memos.createdAt))
    .limit(limit);
}

export async function getMemoById(id: number): Promise<Memo | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  return result[0] || null;
}

export async function updateMemoStatus(id: number, status: "draft" | "categorizing" | "completed"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(memos).set({ status, updatedAt: new Date() }).where(eq(memos.id, id));
}

// ─── Categorization helpers ───
export async function saveCategorization(categorization: InsertCategorization): Promise<Categorization | null> {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(categorizations).values(categorization).$returningId();
  const id = inserted[0]?.id;
  if (id === undefined) return null;
  const created = await db.select().from(categorizations).where(eq(categorizations.id, id)).limit(1);
  return created[0] || null;
}

export async function getCategorizationByMemoId(memoId: number): Promise<Categorization | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(categorizations).where(eq(categorizations.memoId, memoId)).limit(1);
  return result[0] || null;
}

export async function updateCategorization(id: number, updates: Partial<Categorization>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(categorizations).set({ ...updates, updatedAt: new Date() }).where(eq(categorizations.id, id));
}

// ─── Analysis Result helpers ───
export async function saveAnalysisResult(analysis: InsertAnalysisResult): Promise<AnalysisResult | null> {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(analysisResults).values(analysis).$returningId();
  const id = inserted[0]?.id;
  if (id === undefined) return null;
  const created = await db.select().from(analysisResults).where(eq(analysisResults.id, id)).limit(1);
  return created[0] || null;
}

export async function getAnalysisResultByMemoId(memoId: number): Promise<AnalysisResult | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(analysisResults).where(eq(analysisResults.memoId, memoId)).limit(1);
  return result[0] || null;
}
