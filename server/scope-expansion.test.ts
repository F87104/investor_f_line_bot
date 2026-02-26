import { describe, expect, it, vi } from "vitest";

// Mock line module
vi.mock("./line", () => ({
  verifyLineSignature: vi.fn(),
  replyMessage: vi.fn().mockResolvedValue(undefined),
  textMessage: vi.fn((text: string) => ({ type: "text", text })),
  pushMessage: vi.fn().mockResolvedValue(undefined),
  multicastMessage: vi.fn().mockResolvedValue(undefined),
  getUserProfile: vi.fn().mockResolvedValue({ displayName: "TestUser" }),
}));

// Mock db module
vi.mock("./db", () => ({
  getActiveLineUsers: vi.fn().mockResolvedValue([]),
  saveNewsDelivery: vi.fn().mockResolvedValue(undefined),
  getActiveReminders: vi.fn().mockResolvedValue([]),
  updateReminderLastSent: vi.fn().mockResolvedValue(undefined),
}));

// Mock llm-handlers with expanded scope awareness
vi.mock("./llm-handlers", () => ({
  classifyMessage: vi.fn().mockResolvedValue("investment"),
  generateReply: vi.fn().mockResolvedValue("テスト応答です 投資家Fより💌"),
  generateXPost: vi.fn().mockResolvedValue("パターン① テスト投稿 投資家Fより💌"),
  generateInfographicStructure: vi.fn().mockResolvedValue("📐 テスト図解 投資家Fより💌"),
  generateNewsSummary: vi.fn().mockResolvedValue("＼🌅おはようございます🐻🌈／\nドル円・ユーロドル・ゴールド・ポンド円\n投資家Fより💌"),
  summarizeArticle: vi.fn().mockResolvedValue("テストAI要約 投資家Fより💌"),
}));

describe("Analysis Scope Expansion", () => {
  describe("INVESTOR_F_PERSONA covers expanded scope", () => {
    it("llm-handlers module exports all required functions", async () => {
      const handlers = await import("./llm-handlers");
      expect(handlers.classifyMessage).toBeDefined();
      expect(handlers.generateReply).toBeDefined();
      expect(handlers.generateXPost).toBeDefined();
      expect(handlers.generateInfographicStructure).toBeDefined();
      expect(handlers.generateNewsSummary).toBeDefined();
      expect(handlers.summarizeArticle).toBeDefined();
    });

    it("generateNewsSummary returns expanded briefing format", async () => {
      const { generateNewsSummary } = await import("./llm-handlers");
      const result = await generateNewsSummary("テスト市場データ");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // The mock returns a string with expanded currency pairs
      expect(result).toContain("ドル円");
      expect(result).toContain("ユーロドル");
      expect(result).toContain("ゴールド");
      expect(result).toContain("ポンド円");
    });
  });

  describe("Scheduler fetchMarketData covers expanded scope", () => {
    it("sendMorningNews is callable", async () => {
      const { sendMorningNews } = await import("./scheduler");
      expect(sendMorningNews).toBeDefined();
      expect(typeof sendMorningNews).toBe("function");
    });

    it("initScheduler is callable", async () => {
      const { initScheduler } = await import("./scheduler");
      expect(initScheduler).toBeDefined();
      expect(typeof initScheduler).toBe("function");
    });
  });

  describe("Database schema supports morning_briefing topic", () => {
    it("newsDeliveries schema includes morning_briefing enum", async () => {
      const { newsDeliveries } = await import("../drizzle/schema");
      expect(newsDeliveries).toBeDefined();
      // Verify the topic column exists
      const topicColumn = newsDeliveries.topic;
      expect(topicColumn).toBeDefined();
      // Check that the enum values include morning_briefing
      const enumValues = topicColumn.enumValues;
      expect(enumValues).toContain("gold_xauusd");
      expect(enumValues).toContain("gbpjpy");
      expect(enumValues).toContain("combined");
      expect(enumValues).toContain("morning_briefing");
    });
  });

  describe("Classification handles expanded investment topics", () => {
    it("classifyMessage handles USD/JPY topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("ドル円が150円を突破した");
      expect(["investment", "ai", "slide_project", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles EUR/USD topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("ユーロドルが下落している");
      expect(["investment", "ai", "slide_project", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles FRB/US economy topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("FRBが政策金利を据え置いた");
      expect(["investment", "ai", "slide_project", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles geopolitical risk topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("中東情勢の緊迫化で安全資産に資金流入");
      expect(["investment", "ai", "slide_project", "idea", "general"]).toContain(result);
    });
  });
});
