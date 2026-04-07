import { Request, Response, Express } from "express";
import { verifyLineSignature, replyMessage, textMessage, pushMessage, getUserProfile } from "./line";
import { upsertLineUser, saveMessage, createMemo, getMemos, getMemoById } from "./db";
import { classifyMessage, generateReply, generateShiwakeGuide, generateKotaeawase, summarizeArticle } from "./llm-handlers";
import { isUrl, extractUrl, scrapeUrl } from "./scraper";

// ─── Webhook Event Types ───
interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; id?: string };
  timestamp?: number;
}

interface WebhookBody {
  events: LineEvent[];
  destination?: string;
}

// ─── User Session State (in-memory for simplicity) ───
const userSessions: Map<string, {
  currentMemoId?: number;
  step?: "waiting_memo" | "waiting_shiwake" | "waiting_abstraction" | "waiting_concrete" | "waiting_transfer";
  factContent?: string;
  abstraction?: string;
  concrete?: string;
}> = new Map();

// ─── Command Handlers ───
const COMMANDS: Record<string, (args: string, userId: string) => Promise<string>> = {
  "/memo": async (_args: string, userId: string) => {
    userSessions.set(userId, { step: "waiting_memo" });
    return `📝 メモ入力モード\n\n思いついたこと、気づいたこと、\n感じたことを自由に書いてください。\n\n日常の些細なことでもOKです！\n前田裕二さんは「すべての出来事に\n学びがある」と言っています。\n\n---\n💡 ヒント: 具体的な事実（ファクト）を\nそのまま書くのがコツです`;
  },
  "/shiwake": async (_args: string, userId: string) => {
    const session = userSessions.get(userId);
    if (!session?.factContent) {
      return `📋 仕分けワーク\n\nまだメモが入力されていません。\n\nまず「/memo」でメモを入力してから\n仕分けワークを始めましょう！\n\n---\n「/memo」→ メモ入力\n「/shiwake」→ 仕分けワーク\n「/kotaeawase」→ 答え合わせ`;
    }
    const guide = await generateShiwakeGuide(session.factContent);
    userSessions.set(userId, { ...session, step: "waiting_abstraction" });
    return guide;
  },
  "/kotaeawase": async (_args: string, userId: string) => {
    const session = userSessions.get(userId);
    if (!session?.factContent) {
      return `✅ 答え合わせ\n\nまだメモが入力されていません。\n\nまず「/memo」でメモを入力してから\n答え合わせをしましょう！\n\n---\n「/memo」→ メモ入力\n「/shiwake」→ 仕分けワーク\n「/kotaeawase」→ 答え合わせ`;
    }
    const result = await generateKotaeawase(
      session.factContent,
      session.abstraction,
      session.concrete,
      session.step === "waiting_transfer" ? undefined : undefined
    );
    // Reset session after kotaeawase
    userSessions.set(userId, {});
    return result;
  },
  "/history": async (_args: string, userId: string) => {
    try {
      const memos = await getMemos(userId, 5);
      if (memos.length === 0) {
        return `📚 メモ履歴\n\nまだメモがありません。\n\n「/memo」でメモを入力して\n思考の記録を始めましょう！`;
      }
      let response = `📚 最近のメモ（${memos.length}件）\n\n`;
      memos.forEach((memo: any, i: number) => {
        const date = new Date(memo.createdAt).toLocaleDateString("ja-JP");
        const preview = memo.factContent.substring(0, 50) + (memo.factContent.length > 50 ? "..." : "");
        const statusIcon = memo.status === "analyzed" ? "✅" : memo.status === "categorized" ? "📋" : "📝";
        response += `${statusIcon} ${date}\n${preview}\n\n`;
      });
      response += `---\nダッシュボードで詳細を確認できます`;
      return response;
    } catch (e) {
      return `📚 メモ履歴\n\nメモの取得に失敗しました。\nしばらくしてからお試しください。`;
    }
  },
  "/mynote": async (_args: string, userId: string) => {
    try {
      const memos = await getMemos(userId, 100);
      const analyzed = memos.filter((m: any) => m.status === "analyzed").length;
      const categorized = memos.filter((m: any) => m.status === "categorized").length;
      const draft = memos.filter((m: any) => m.status === "draft").length;

      return `📁 マイノート\n\n📊 メモの統計:\n` +
        `・総メモ数: ${memos.length}件\n` +
        `・分析済み: ${analyzed}件 ✅\n` +
        `・仕分け済み: ${categorized}件 📋\n` +
        `・下書き: ${draft}件 📝\n\n` +
        `---\n詳細はダッシュボードで確認できます`;
    } catch (e) {
      return `📁 マイノート\n\nデータの取得に失敗しました。\nしばらくしてからお試しください。`;
    }
  },
  "/summary": async (input: string, _userId: string) => {
    if (!input) {
      return `📝 要約機能\n\n使い方:\n\n① 記事URLを送る\n/summary https://...\n\n② テキストを送る\n/summary 要約したい文章...\n\n前田裕二の「メモの魔力」式で\n要約をお届けします！`;
    }

    const url = extractUrl(input);
    if (url) {
      try {
        const article = await scrapeUrl(url);
        const summary = await summarizeArticle(
          `タイトル: ${article.title}\n\n${article.content}`,
          article.url
        );
        return summary;
      } catch (e: any) {
        return `記事の取得に失敗しました。\n\n${e.message}\n\n代わりに記事のテキストを\n直接貼り付けてみてください。`;
      }
    } else {
      const summary = await summarizeArticle(input);
      return summary;
    }
  },
  "/help": async () => {
    return `📖 メモの魔力 使い方ガイド\n\n` +
      `📝 /memo\n→ メモを入力する\n\n` +
      `🧠 /shiwake\n→ 仕分けワーク開始\n  （抽象化・具体化・転用）\n\n` +
      `✅ /kotaeawase\n→ 前田裕二的「答え合わせ」\n\n` +
      `📚 /history\n→ 最近のメモ履歴\n\n` +
      `📁 /mynote\n→ メモの統計情報\n\n` +
      `📝 /summary [URLまたはテキスト]\n→ メモの魔力式 要約\n\n` +
      `💬 普通にメッセージ\n→ 前田裕二が考察してくれます\n\n` +
      `何でも気軽にメモしてください！`;
  },
};

// ─── Category Labels ───
const CATEGORY_EMOJI: Record<string, string> = {
  business: "💼",
  personal: "🌱",
  learning: "📖",
  idea: "💡",
  general: "💬",
};

const CATEGORY_LABEL: Record<string, string> = {
  business: "ビジネス",
  personal: "自己成長",
  learning: "学び",
  idea: "アイデア",
  general: "一般",
};

// ─── Process Text Message ───
async function processTextMessage(event: LineEvent) {
  const userId = event.source?.userId;
  const text = event.message?.text?.trim();
  const replyToken = event.replyToken;

  if (!userId || !text || !replyToken) return;

  // Save user
  try {
    const profile = await getUserProfile(userId);
    await upsertLineUser(userId, profile.displayName);
  } catch {
    await upsertLineUser(userId);
  }

  // Check for commands
  const lowerText = text.toLowerCase();
  for (const [cmd, handler] of Object.entries(COMMANDS)) {
    if (lowerText.startsWith(cmd)) {
      const args = text.slice(cmd.length).trim();
      const response = await handler(args, userId);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(response)]);
      return;
    }
  }

  // Check session state for workflow
  const session = userSessions.get(userId);

  if (session?.step === "waiting_memo") {
    // User is entering a memo
    try {
      const memo = await createMemo({ lineUserId: userId, factContent: text });
      const memoId = memo?.id;
      userSessions.set(userId, { currentMemoId: memoId, factContent: text, step: "waiting_shiwake" });

      const guide = await generateShiwakeGuide(text);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: guide, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(guide)]);
      return;
    } catch (e) {
      console.error("[Webhook] Memo creation error:", e);
    }
  }

  if (session?.step === "waiting_abstraction") {
    // User is entering abstraction
    userSessions.set(userId, { ...session, abstraction: text, step: "waiting_concrete" });
    const response = `🔍 抽象化を受け取りました！\n\n「${text.substring(0, 80)}${text.length > 80 ? "..." : ""}」\n\n次は【具体化】です。\nこの法則が当てはまる\n別の場面を考えてみてください。\n\n---\nスキップして答え合わせに進むには\n「/kotaeawase」と送ってください`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  if (session?.step === "waiting_concrete") {
    // User is entering concrete examples
    userSessions.set(userId, { ...session, concrete: text, step: "waiting_transfer" });
    const response = `💡 具体例を受け取りました！\n\n「${text.substring(0, 80)}${text.length > 80 ? "..." : ""}」\n\n最後は【転用】です。\nこの気づきを、あなたの仕事や\n生活にどう活かせますか？\n\n---\nスキップして答え合わせに進むには\n「/kotaeawase」と送ってください`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  if (session?.step === "waiting_transfer") {
    // User is entering transfer - auto trigger kotaeawase
    const result = await generateKotaeawase(
      session.factContent || "",
      session.abstraction,
      session.concrete,
      text
    );
    userSessions.set(userId, {});
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
    await replyMessage(replyToken, [textMessage(result)]);
    return;
  }

  // Default: classify and respond with Maeda-style analysis
  const category = await classifyMessage(text);
  await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });

  // Auto-save as memo
  try {
    await createMemo({ lineUserId: userId, factContent: text });
  } catch (e) {
    console.error("[Webhook] Auto memo save error:", e);
  }

  const reply = await generateReply(text, category);
  const categoryTag = `[${CATEGORY_EMOJI[category]} ${CATEGORY_LABEL[category]}]`;
  const fullReply = `${categoryTag}\n\n${reply}\n\n---\n💡 仕分けワーク: /shiwake\n✅ 答え合わせ: /kotaeawase`;

  await saveMessage({ lineUserId: userId, direction: "outgoing", content: fullReply, messageType: "analysis_result" });
  await replyMessage(replyToken, [textMessage(fullReply)]);
}

// ─── Process Follow Event ───
async function processFollowEvent(event: LineEvent) {
  const userId = event.source?.userId;
  if (!userId) return;

  try {
    const profile = await getUserProfile(userId);
    await upsertLineUser(userId, profile.displayName);
  } catch {
    await upsertLineUser(userId);
  }

  if (event.replyToken) {
    const welcomeMessage = `はじめまして！\n\n` +
      `「メモの魔力」へようこそ ✨\n\n` +
      `このアプリでは、前田裕二さんの\n「メモの魔力」メソッドを使って\n思考を深めることができます。\n\n` +
      `📝 思いついたことをメモする\n🧠 抽象化・具体化・転用で仕分け\n✅ 前田裕二的な「答え合わせ」\n\n` +
      `使い方はシンプル:\n\n` +
      `① 「/memo」でメモを入力\n` +
      `② 「/shiwake」で仕分けワーク\n` +
      `③ 「/kotaeawase」で答え合わせ\n\n` +
      `または、そのままメッセージを\n送るだけでもOKです！\n\n` +
      `さあ、今日から「メモの魔力」で\n新しい発見を始めましょう！`;
    await replyMessage(event.replyToken, [textMessage(welcomeMessage)]);
  }
}

// ─── Register Webhook Route ───
export function registerWebhookRoute(app: Express) {
  app.post("/api/webhook", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-line-signature"] as string;
      if (!signature) {
        console.warn("[Webhook] Missing x-line-signature header");
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      const rawBody = JSON.stringify(req.body);
      if (!verifyLineSignature(rawBody, signature)) {
        console.warn("[Webhook] Invalid signature");
        res.status(403).json({ error: "Invalid signature" });
        return;
      }

      const body = req.body as WebhookBody;
      console.log(`[Webhook] Received ${body.events?.length ?? 0} events`);

      res.status(200).json({ status: "ok" });

      for (const event of body.events || []) {
        try {
          switch (event.type) {
            case "message":
              if (event.message?.type === "text") {
                await processTextMessage(event);
              }
              break;
            case "follow":
              await processFollowEvent(event);
              break;
            case "unfollow":
              console.log(`[Webhook] User unfollowed: ${event.source?.userId}`);
              break;
            default:
              console.log(`[Webhook] Unhandled event type: ${event.type}`);
          }
        } catch (err) {
          console.error(`[Webhook] Error processing event:`, err);
        }
      }
    } catch (err) {
      console.error("[Webhook] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.get("/api/webhook", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "LINE Webhook endpoint is active" });
  });
}
