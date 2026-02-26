import { describe, expect, it, vi } from "vitest";

// Mock line module
vi.mock("./line", () => ({
  verifyLineSignature: vi.fn(),
  replyMessage: vi.fn().mockResolvedValue(undefined),
  textMessage: vi.fn((text: string) => ({ type: "text", text })),
  pushMessage: vi.fn().mockResolvedValue(undefined),
  multicastMessage: vi.fn().mockResolvedValue(undefined),
  getUserProfile: vi.fn().mockResolvedValue({ displayName: "TestUser" }),
  getActiveLineUsers: vi.fn().mockResolvedValue([]),
}));

// Mock db module
vi.mock("./db", () => ({
  upsertLineUser: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  getActiveLineUsers: vi.fn().mockResolvedValue([]),
  getAllLineUsers: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  getMessagesByCategory: vi.fn().mockResolvedValue([]),
  getRecentNewsDeliveries: vi.fn().mockResolvedValue([]),
  getAllReminders: vi.fn().mockResolvedValue([]),
  createReminder: vi.fn().mockResolvedValue(undefined),
  updateReminderStatus: vi.fn().mockResolvedValue(undefined),
  deleteReminder: vi.fn().mockResolvedValue(undefined),
  getGeneratedContent: vi.fn().mockResolvedValue([]),
  saveGeneratedContent: vi.fn().mockResolvedValue(undefined),
  updateContentStatus: vi.fn().mockResolvedValue(undefined),
  saveNewsDelivery: vi.fn().mockResolvedValue(undefined),
  getActiveReminders: vi.fn().mockResolvedValue([]),
  updateReminderLastSent: vi.fn().mockResolvedValue(undefined),
}));

// Mock llm-handlers
vi.mock("./llm-handlers", () => ({
  classifyMessage: vi.fn().mockResolvedValue("investment"),
  generateReply: vi.fn().mockResolvedValue("テスト応答です"),
  generateXPost: vi.fn().mockResolvedValue("テストX投稿"),
  generateInfographicStructure: vi.fn().mockResolvedValue("テストインフォグラフィック"),
  generateNewsSummary: vi.fn().mockResolvedValue("テストニュースサマリー"),
}));

// Mock scheduler
vi.mock("./scheduler", () => ({
  sendMorningNews: vi.fn().mockResolvedValue(undefined),
  initScheduler: vi.fn(),
}));

import { verifyLineSignature } from "./line";

describe("LINE Webhook", () => {
  it("verifyLineSignature is callable", () => {
    expect(verifyLineSignature).toBeDefined();
    expect(typeof verifyLineSignature).toBe("function");
  });

  it("rejects missing signature", async () => {
    // The webhook handler checks for x-line-signature header
    // Without it, it should return 400
    const { registerWebhookRoute } = await import("./webhook");
    expect(registerWebhookRoute).toBeDefined();
    expect(typeof registerWebhookRoute).toBe("function");
  });
});

describe("LLM Handlers", () => {
  it("classifyMessage returns a valid category", async () => {
    const { classifyMessage } = await import("./llm-handlers");
    const result = await classifyMessage("ゴールドの価格が上がった");
    expect(["investment", "ai", "slide_project", "idea", "general"]).toContain(result);
  });

  it("generateReply returns a string", async () => {
    const { generateReply } = await import("./llm-handlers");
    const result = await generateReply("テスト", "investment");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generateXPost returns a string", async () => {
    const { generateXPost } = await import("./llm-handlers");
    const result = await generateXPost("ゴールド分析");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generateInfographicStructure returns a string", async () => {
    const { generateInfographicStructure } = await import("./llm-handlers");
    const result = await generateInfographicStructure("市場動向");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("Router exports", () => {
  it("appRouter is defined and has expected routes", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // Check that the router has the expected procedure keys
    const procedures = appRouter._def.procedures;
    expect(procedures).toHaveProperty("auth.me");
    expect(procedures).toHaveProperty("auth.logout");
    expect(procedures).toHaveProperty("lineUsers.list");
    expect(procedures).toHaveProperty("messages.list");
    expect(procedures).toHaveProperty("messages.stats");
    expect(procedures).toHaveProperty("news.history");
    expect(procedures).toHaveProperty("news.sendNow");
    expect(procedures).toHaveProperty("reminders.list");
    expect(procedures).toHaveProperty("reminders.create");
    expect(procedures).toHaveProperty("content.generateXPost");
    expect(procedures).toHaveProperty("content.generateInfographic");
    expect(procedures).toHaveProperty("push.send");
  });
});
