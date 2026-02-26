import { Request, Response, Express } from "express";
import { verifyLineSignature, replyMessage, textMessage, pushMessage, getUserProfile } from "./line";
import { upsertLineUser, saveMessage } from "./db";
import { classifyMessage, generateReply, generateXPost, generateInfographicStructure } from "./llm-handlers";

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
    return `📝 X投稿案:\n\n${post}\n\n---\nこの投稿でよければ、そのままコピーしてXに投稿してください！`;
  },
  "/infographic": async (topic: string) => {
    const structure = await generateInfographicStructure(topic || "ゴールド市場の最新動向");
    return `🎨 インフォグラフィック構成案:\n\n${structure}`;
  },
  "/news": async () => {
    const { sendMorningNews } = await import("./scheduler");
    // Trigger news delivery
    sendMorningNews().catch(console.error);
    return `📰 最新の経済ニュースを取得中です...

ゴールド（XAUUSD）とGBP/JPYの市場情報をまもなくお届けします。`;
  },
  "/categories": async () => {
    return `📋 カテゴリ分類システム\n\n` +
      `あなたのメッセージは自動的に以下のカテゴリに分類されます：\n\n` +
      `📈 投資 - 市場分析、トレード、ゴールド、FX\n` +
      `🤖 AI - AI技術、ツール、活用法\n` +
      `📊 スライド - プレゼン、図解、コンテンツ制作\n` +
      `💡 アイデア - ブレインストーミング、新規アイデア\n` +
      `💬 一般 - その他の会話\n\n` +
      `分類結果はダッシュボードで確認できます。`;
  },
  "/help": async () => {
    return `🤖 投資家Fアシスタント コマンド一覧\n\n` +
      `📝 /xpost [トピック]\n→ X投稿の文案を生成\n\n` +
      `🎨 /infographic [トピック]\n→ インフォグラフィック構成案を生成\n\n` +
      `📰 /news\n→ 最新の経済ニュースを取得\n\n` +
      `📋 /categories\n→ カテゴリ分類の説明\n\n` +
      `💬 通常のメッセージ\n→ 自動分類＆AI応答\n\n` +
      `カテゴリ自動分類:\n` +
      `📈 投資 | 🤖 AI | 📊 スライド | 💡 アイデア | 💬 一般`;
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
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, category: "general" });
      // Save outgoing message
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, category: "general" });
      await replyMessage(replyToken, [textMessage(response)]);
      return;
    }
  }

  // Classify message
  const category = await classifyMessage(text);

  // Save incoming message with category
  await saveMessage({ lineUserId: userId, direction: "incoming", content: text, category });

  // Generate reply
  const reply = await generateReply(text, category);
  const categoryTag = `[${CATEGORY_EMOJI[category]} ${CATEGORY_LABEL[category]}]`;
  const fullReply = `${categoryTag}\n\n${reply}`;

  // Save outgoing message
  await saveMessage({ lineUserId: userId, direction: "outgoing", content: fullReply, category });

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
    const welcomeMessage = `🎉 友だち追加ありがとうございます！\n\n` +
      `私は「投資家Fアシスタント」です。\n\n` +
      `📈 ゴールド・ポンド円の市場分析\n` +
      `🤖 AI活用の投資アドバイス\n` +
      `📝 X投稿の文案作成\n` +
      `🎨 インフォグラフィック構成提案\n` +
      `💡 アイデア整理\n\n` +
      `をサポートします！\n\n` +
      `コマンド一覧は /help で確認できます。\n` +
      `何でもお気軽にメッセージしてください！`;
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
