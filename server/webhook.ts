import { Request, Response, Express } from "express";
import { verifyLineSignature, replyMessage, textMessage, pushMessage, getUserProfile } from "./line";
import { upsertLineUser, saveMessage } from "./db";
import { classifyMessage, generateReply, generateXPost, generateInfographicStructure, summarizeArticle } from "./llm-handlers";
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

// ─── Command Handlers ───
const COMMANDS: Record<string, (args: string) => Promise<string>> = {
  "/xpost": async (topic: string) => {
    const post = await generateXPost(topic || "ゴールドとポンド円の最新市場分析");
    return `📝 X投稿案だよ🐻✨\n\n${post}\n\n---\n気に入ったパターンがあれば、\nそのままコピペしてXに投稿してね🌷\n\n投資家Fより💌`;
  },
  "/infographic": async (topic: string) => {
    const structure = await generateInfographicStructure(topic || "ゴールド市場の最新動向");
    return structure;
  },
  "/news": async () => {
    const { sendMorningNews } = await import("./scheduler");
    sendMorningNews().catch(console.error);
    return `📰 最新ニュースを取得中だよ🐻✨\n\nゴールド（XAUUSD）と\nポンド円（GBP/JPY）の\n市場情報をまもなくお届けするね🌷\n\nちょっと待っててね🍀\n\n投資家Fより💌`;
  },
  "/categories": async () => {
    return `📋 カテゴリ分類のしくみ🐻🌈\n\n` +
      `メッセージを送ると、\nAIが自動で分類してくれるよ✨\n\n` +
      `📈 投資 - 市場分析、トレード、ゴールド、FX\n` +
      `🤖 AI - AI技術、ツール、活用法\n` +
      `📊 スライド - プレゼン、図解、コンテンツ制作\n` +
      `💡 アイデア - ブレインストーミング、新規アイデア\n` +
      `💬 一般 - その他の会話\n\n` +
      `分類結果はダッシュボードで\n確認できるよ🌷\n\n投資家Fより💌`;
  },
  "/summary": async (input: string) => {
    if (!input) {
      return `📝 AI要約機能だよ🐻✨\n\n使い方は簡単！\n\n① 記事URLを送る\n/summary https://...\n\n② テキストを送る\n/summary 要約したい文章...\n\n投資家Fの視点で\n要約してお届けするね🌷\n\n投資家Fより💌`;
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
        return `記事の取得に失敗しちゃった🐻💦\n\n${e.message}\n\n代わりに記事のテキストを\n直接貼り付けてみてね✨\n\n投資家Fより💌`;
      }
    } else {
      // Direct text summary
      const summary = await summarizeArticle(input);
      return summary;
    }
  },
  "/help": async () => {
    return `🐻🌈 投資家Fアシスタント\nコマンド一覧だよ✨\n\n` +
      `📝 /xpost [トピック]\n→ X投稿の文案を3パターン生成\n\n` +
      `🎨 /infographic [トピック]\n→ 図解の構成案を生成\n\n` +
      `📰 /news\n→ 最新の経済ニュースを取得\n\n` +
      `🧠 /summary [URLまたはテキスト]\n→ AI要約（Fの視点付き）\n\n` +
      `📋 /categories\n→ カテゴリ分類の説明\n\n` +
      `💬 普通にメッセージ\n→ 自動分類＆Fが応答するよ🌷\n\n` +
      `何でも気軽に話しかけてね🍀\n\n投資家Fより💌`;
  },
};

// ─── Category Emoji Map ───
const CATEGORY_EMOJI: Record<string, string> = {
  investment: "📈",
  ai: "🤖",
  slide_project: "📊",
  idea: "💡",
  general: "💬",
};

const CATEGORY_LABEL: Record<string, string> = {
  investment: "投資",
  ai: "AI",
  slide_project: "スライドプロジェクト",
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
      const response = await handler(args);
      // Save incoming message
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      // Save outgoing message
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "analysis_result" });
      await replyMessage(replyToken, [textMessage(response)]);
      return;
    }
  }

  // Classify message
  const category = await classifyMessage(text);

  // Save incoming message with category
  await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });

  // Generate reply
  const reply = await generateReply(text, category);
  const categoryTag = `[${CATEGORY_EMOJI[category]} ${CATEGORY_LABEL[category]}]`;
  const fullReply = `${categoryTag}\n\n${reply}`;

  // Save outgoing message
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
    const welcomeMessage = `＼はじめまして🐻🌈／\n\n` +
      `友だち追加ありがとう✨\n` +
      `投資家Fのアシスタントだよ🌷\n\n` +
      `こんなことができるよ：\n\n` +
      `📈 ゴールド・ポンド円の市場分析\n` +
      `📝 X投稿の文案作成（3パターン）\n` +
      `🎨 図解の構成案を提案\n` +
      `📰 毎朝7時に経済ニュース配信\n` +
      `💡 アイデア整理のお手伝い\n\n` +
      `コマンド一覧は /help で確認してね🍀\n\n` +
      `何でも気軽にメッセージしてね😉\n\n` +
      `投資家Fより💌`;
    await replyMessage(event.replyToken, [textMessage(welcomeMessage)]);
  }
}

// ─── Register Webhook Route ───
export function registerWebhookRoute(app: Express) {
  // LINE Webhook needs raw body for signature verification
  app.post("/api/webhook", async (req: Request, res: Response) => {
    try {
      // Get raw body for signature verification
      const signature = req.headers["x-line-signature"] as string;
      if (!signature) {
        console.warn("[Webhook] Missing x-line-signature header");
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      // Verify signature using the JSON body
      const rawBody = JSON.stringify(req.body);
      if (!verifyLineSignature(rawBody, signature)) {
        console.warn("[Webhook] Invalid signature");
        res.status(403).json({ error: "Invalid signature" });
        return;
      }

      const body = req.body as WebhookBody;
      console.log(`[Webhook] Received ${body.events?.length ?? 0} events`);

      // Respond immediately to LINE
      res.status(200).json({ status: "ok" });

      // Process events asynchronously
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
              // User blocked the bot - could mark as inactive
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

  // Health check endpoint for LINE webhook verification
  app.get("/api/webhook", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "LINE Webhook endpoint is active" });
  });
}
