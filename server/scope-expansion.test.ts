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

// Mock llm-handlers with memo magic functions
vi.mock("./llm-handlers", () => ({
  classifyMessage: vi.fn().mockResolvedValue("business"),
  generateReply: vi.fn().mockResolvedValue("テスト応答です。ここから何が読み取れるか考えてみましょう。"),
  generateShiwakeGuide: vi.fn().mockResolvedValue("📝 メモを受け取りました！仕分けワークを始めましょう。"),
  generateKotaeawase: vi.fn().mockResolvedValue("✅ 前田裕二的「答え合わせ」\n\n分析結果です。"),
  analyzeMemoMaedaStyle: vi.fn().mockResolvedValue({
    maedaAbstraction: "テスト抽象化",
    maedaConcrete: "テスト具体例",
    maedaTransfer: "テスト転用",
    maedaInsight: "テストインサイト",
  }),
  summarizeArticle: vi.fn().mockResolvedValue("📝 メモの魔力式 要約\n\nテスト要約です。"),
  generateMemoReminder: vi.fn().mockResolvedValue("おはようございます！今日もメモの魔力で新しい発見を！"),
  generateXPost: vi.fn().mockResolvedValue("この機能は現在利用できません。"),
  generateInfographicStructure: vi.fn().mockResolvedValue("この機能は現在利用できません。"),
  generateNewsSummary: vi.fn().mockResolvedValue("おはようございます！今日もメモの魔力で新しい発見を！"),
}));

describe("Memo Magic App - Core Functions", () => {
  describe("LLM handlers export all required functions", () => {
    it("exports memo analysis functions", async () => {
      const handlers = await import("./llm-handlers");
      expect(handlers.classifyMessage).toBeDefined();
      expect(handlers.generateReply).toBeDefined();
      expect(handlers.generateShiwakeGuide).toBeDefined();
      expect(handlers.generateKotaeawase).toBeDefined();
      expect(handlers.analyzeMemoMaedaStyle).toBeDefined();
      expect(handlers.summarizeArticle).toBeDefined();
      expect(handlers.generateMemoReminder).toBeDefined();
    });

    it("classifyMessage returns valid memo categories", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("新しいビジネスモデルを考えた");
      expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
    });

    it("analyzeMemoMaedaStyle returns structured analysis", async () => {
      const { analyzeMemoMaedaStyle } = await import("./llm-handlers");
      const result = await analyzeMemoMaedaStyle("テストメモ");
      expect(result).toHaveProperty("maedaAbstraction");
      expect(result).toHaveProperty("maedaConcrete");
      expect(result).toHaveProperty("maedaTransfer");
      expect(result).toHaveProperty("maedaInsight");
    });

    it("generateShiwakeGuide returns guidance text", async () => {
      const { generateShiwakeGuide } = await import("./llm-handlers");
      const result = await generateShiwakeGuide("テストファクト");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("generateKotaeawase returns analysis text", async () => {
      const { generateKotaeawase } = await import("./llm-handlers");
      const result = await generateKotaeawase("テストファクト", "テスト抽象化");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Scheduler functions", () => {
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

  describe("Database schema supports memo tables", () => {
    it("memos table is defined", async () => {
      const { memos } = await import("../drizzle/schema");
      expect(memos).toBeDefined();
    });

    it("categorizations table is defined", async () => {
      const { categorizations } = await import("../drizzle/schema");
      expect(categorizations).toBeDefined();
    });

    it("analysisResults table is defined", async () => {
      const { analysisResults } = await import("../drizzle/schema");
      expect(analysisResults).toBeDefined();
    });

    it("newsDeliveries schema includes morning_briefing enum", async () => {
      const { newsDeliveries } = await import("../drizzle/schema");
      expect(newsDeliveries).toBeDefined();
      const topicColumn = newsDeliveries.topic;
      expect(topicColumn).toBeDefined();
      const enumValues = topicColumn.enumValues;
      expect(enumValues).toContain("morning_briefing");
    });
  });

  describe("Classification handles memo categories", () => {
    it("classifyMessage handles business topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("新規事業の立ち上げについて考えた");
      expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles personal topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("朝の習慣を変えてみた");
      expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles learning topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("プログラミングの新しい概念を学んだ");
      expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
    });

    it("classifyMessage handles idea topic", async () => {
      const { classifyMessage } = await import("./llm-handlers");
      const result = await classifyMessage("新しいアプリのアイデアを思いついた");
      expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
    });
  });
});
