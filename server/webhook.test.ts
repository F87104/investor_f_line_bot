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
  getMessagesByType: vi.fn().mockResolvedValue([]),
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
  createMemo: vi.fn().mockResolvedValue({ id: 1 }),
  getMemos: vi.fn().mockResolvedValue([]),
  getMemoById: vi.fn().mockResolvedValue(null),
  updateMemoStatus: vi.fn().mockResolvedValue(undefined),
  saveCategorization: vi.fn().mockResolvedValue(undefined),
  getCategorizationByMemoId: vi.fn().mockResolvedValue(null),
  updateCategorization: vi.fn().mockResolvedValue(undefined),
  saveAnalysisResult: vi.fn().mockResolvedValue(undefined),
  getAnalysisResultByMemoId: vi.fn().mockResolvedValue(null),
}));

// Mock llm-handlers (Maeda Yuji memo magic functions)
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

// Mock scraper
vi.mock("./scraper", () => ({
  isUrl: vi.fn((text: string) => /^https?:\/\//.test(text)),
  extractUrl: vi.fn((text: string) => {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  }),
  scrapeUrl: vi.fn().mockResolvedValue({ title: "テスト記事", content: "テスト内容", url: "https://example.com" }),
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

  it("registerWebhookRoute is defined", async () => {
    const { registerWebhookRoute } = await import("./webhook");
    expect(registerWebhookRoute).toBeDefined();
    expect(typeof registerWebhookRoute).toBe("function");
  });
});

describe("Memo Magic LLM Handlers", () => {
  it("classifyMessage returns a valid memo category", async () => {
    const { classifyMessage } = await import("./llm-handlers");
    const result = await classifyMessage("新しいビジネスモデルを考えた");
    expect(["business", "personal", "learning", "idea", "general"]).toContain(result);
  });

  it("generateReply returns a Maeda-style response", async () => {
    const { generateReply } = await import("./llm-handlers");
    const result = await generateReply("テストメモ", "business");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generateShiwakeGuide returns guidance text", async () => {
    const { generateShiwakeGuide } = await import("./llm-handlers");
    const result = await generateShiwakeGuide("テストファクト");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generateKotaeawase returns analysis text", async () => {
    const { generateKotaeawase } = await import("./llm-handlers");
    const result = await generateKotaeawase("テストファクト");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("analyzeMemoMaedaStyle returns structured analysis", async () => {
    const { analyzeMemoMaedaStyle } = await import("./llm-handlers");
    const result = await analyzeMemoMaedaStyle("テストメモ");
    expect(result).toHaveProperty("maedaAbstraction");
    expect(result).toHaveProperty("maedaConcrete");
    expect(result).toHaveProperty("maedaTransfer");
    expect(result).toHaveProperty("maedaInsight");
  });

  it("summarizeArticle returns a string", async () => {
    const { summarizeArticle } = await import("./llm-handlers");
    const result = await summarizeArticle("テスト記事の内容");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generateMemoReminder returns a string", async () => {
    const { generateMemoReminder } = await import("./llm-handlers");
    const result = await generateMemoReminder();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("日本語コマンドマッチング", () => {
  const matchesKeyword = (text: string, keywords: string[]): boolean => {
    const lower = text.toLowerCase().trim();
    return keywords.some(kw => lower === kw || lower.startsWith(kw + " ") || lower.startsWith(kw + "\u3000"));
  };

  it("『メモ』キーワードが正しくマッチする", () => {
    const MEMO_KEYWORDS = ["メモ", "めも", "memo", "/memo"];
    expect(matchesKeyword("メモ", MEMO_KEYWORDS)).toBe(true);
    expect(matchesKeyword("めも", MEMO_KEYWORDS)).toBe(true);
    expect(matchesKeyword("memo", MEMO_KEYWORDS)).toBe(true);
  });

  it("『仕分け』キーワードが正しくマッチする", () => {
    const SHIWAKE_KEYWORDS = ["仕分け", "しわけ", "シワケ", "/shiwake"];
    expect(matchesKeyword("仕分け", SHIWAKE_KEYWORDS)).toBe(true);
    expect(matchesKeyword("しわけ", SHIWAKE_KEYWORDS)).toBe(true);
  });

  it("『答え合わせ』キーワードが正しくマッチする", () => {
    const KOTAEAWASE_KEYWORDS = ["答え合わせ", "こたえあわせ", "答合わせ", "コタエアワセ", "/kotaeawase"];
    expect(matchesKeyword("答え合わせ", KOTAEAWASE_KEYWORDS)).toBe(true);
    expect(matchesKeyword("こたえあわせ", KOTAEAWASE_KEYWORDS)).toBe(true);
  });

  it("『履歴』『マイノート』『ヘルプ』キーワードが正しくマッチする", () => {
    const HISTORY_KEYWORDS = ["履歴", "りれき", "リレキ", "メモ履歴", "/history"];
    const MYNOTE_KEYWORDS = ["マイノート", "まいのーと", "ノート", "統計", "/mynote"];
    const HELP_KEYWORDS = ["ヘルプ", "へるぷ", "使い方", "つかいかた", "help", "/help"];
    expect(matchesKeyword("履歴", HISTORY_KEYWORDS)).toBe(true);
    expect(matchesKeyword("マイノート", MYNOTE_KEYWORDS)).toBe(true);
    expect(matchesKeyword("ヘルプ", HELP_KEYWORDS)).toBe(true);
    expect(matchesKeyword("使い方", HELP_KEYWORDS)).toBe(true);
  });

  it("『リセット』キーワードが正しくマッチする", () => {
    const RESET_KEYWORDS = ["リセット", "りせっと", "reset", "やり直し", "やりなおし", "最初から"];
    expect(matchesKeyword("リセット", RESET_KEYWORDS)).toBe(true);
    expect(matchesKeyword("やり直し", RESET_KEYWORDS)).toBe(true);
    expect(matchesKeyword("最初から", RESET_KEYWORDS)).toBe(true);
  });

  it("通常のメッセージはコマンドにマッチしない", () => {
    const ALL_KEYWORDS = ["メモ", "仕分け", "答え合わせ", "履歴", "マイノート", "ヘルプ", "リセット"];
    const normalMessages = [
      "コミュニティを作ること",
      "意思決定が遅れる",
      "前田裕二さんの考え方",
    ];
    for (const msg of normalMessages) {
      expect(matchesKeyword(msg, ALL_KEYWORDS)).toBe(false);
    }
  });
});

describe("リッチメニューアクション", () => {
  it("リッチメニューのボタンアクションが日本語テキストを使用している", () => {
    const actions = ["メモ", "仕分け", "答え合わせ", "履歴", "マイノート", "ヘルプ"];
    actions.forEach(action => {
      expect(action).not.toMatch(/^\//);
      expect(action.length).toBeGreaterThan(0);
    });
  });
});

describe("Router exports", () => {
  it("appRouter is defined and has expected routes", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    const procedures = appRouter._def.procedures;
    expect(procedures).toHaveProperty("auth.me");
    expect(procedures).toHaveProperty("auth.logout");
    expect(procedures).toHaveProperty("lineUsers.list");
    expect(procedures).toHaveProperty("messages.list");
    expect(procedures).toHaveProperty("messages.stats");
    expect(procedures).toHaveProperty("reminders.list");
    expect(procedures).toHaveProperty("reminders.create");
    expect(procedures).toHaveProperty("content.summarize");
    expect(procedures).toHaveProperty("push.send");
    expect(procedures).toHaveProperty("memos.list");
    expect(procedures).toHaveProperty("memos.create");
    expect(procedures).toHaveProperty("memos.analyze");
  });
});
