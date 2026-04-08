import { Request, Response, Express } from "express";
import express from "express";
import { verifyLineSignature, replyMessage, textMessage, pushMessage, getUserProfile } from "./line";
import { upsertLineUser, saveMessage, createMemo, getMemos, getMemoById } from "./db";
import { classifyAndReply, generateShiwakeGuide, generateKotaeawase, summarizeArticle } from "./llm-handlers";
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
  step?: "waiting_shiwake" | "waiting_abstraction" | "waiting_concrete" | "waiting_transfer";
  factContent?: string;
  abstraction?: string;
  concrete?: string;
}> = new Map();

// ─── Japanese keyword matchers ───
function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase().trim();
  return keywords.some(kw => lower === kw || lower.startsWith(kw + " ") || lower.startsWith(kw + "　"));
}

const SHIWAKE_KEYWORDS = ["仕分け", "しわけ", "シワケ", "/shiwake"];
const KOTAEAWASE_KEYWORDS = ["答え合わせ", "こたえあわせ", "答合わせ", "コタエアワセ", "/kotaeawase"];
const HISTORY_KEYWORDS = ["履歴", "りれき", "リレキ", "メモ履歴", "/history"];
const MYNOTE_KEYWORDS = ["マイノート", "まいのーと", "ノート", "統計", "/mynote"];
const HELP_KEYWORDS = ["ヘルプ", "へるぷ", "使い方", "つかいかた", "help", "/help"];
const SUMMARY_KEYWORDS = ["要約", "ようやく", "/summary"];
const MEMO_KEYWORDS = ["メモ", "めも", "memo", "/memo"];
const SKIP_KEYWORDS = ["スキップ", "すきっぷ", "skip"];
const RESET_KEYWORDS = ["リセット", "りせっと", "reset", "やり直し", "やりなおし", "最初から"];

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

// ─── Command Handlers ───

async function handleShiwake(userId: string): Promise<string> {
  const session = userSessions.get(userId);
  if (!session?.factContent) {
    return `📋 仕分けワーク\n\nまだメモが入力されていません。\n\nまずメモを送ってください！\n何でもOKです。\n\n---\n💡 思いついたことをそのまま\nメッセージで送るだけでOK`;
  }
  const guide = await generateShiwakeGuide(session.factContent);
  userSessions.set(userId, { ...session, step: "waiting_abstraction" });
  return guide;
}

async function handleKotaeawase(userId: string): Promise<string> {
  const session = userSessions.get(userId);
  if (!session?.factContent) {
    return `✅ 答え合わせ\n\nまだメモが入力されていません。\n\nまずメモを送ってください！\n\n---\n💡 思いついたことをそのまま\nメッセージで送るだけでOK`;
  }
  const result = await generateKotaeawase(
    session.factContent,
    session.abstraction,
    session.concrete
  );
  userSessions.set(userId, {});
  return result;
}

async function handleHistory(userId: string): Promise<string> {
  try {
    const memos = await getMemos(userId, 5);
    if (memos.length === 0) {
      return `📚 メモ履歴\n\nまだメモがありません。\n\nメッセージを送るだけで\n自動的にメモとして保存されます！`;
    }
    let response = `📚 最近のメモ（${memos.length}件）\n\n`;
    memos.forEach((memo: any) => {
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
}

async function handleMynote(userId: string): Promise<string> {
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
}

async function handleSummary(input: string): Promise<string> {
  if (!input) {
    return `📝 要約機能\n\n使い方:\n\n① 記事URLを送る\n「要約 https://...」\n\n② テキストを送る\n「要約 要約したい文章...」\n\n前田裕二の「メモの魔力」式で\n要約をお届けします！`;
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
}

function handleHelp(): string {
  return `📖 メモの魔力 使い方ガイド\n\n` +
    `【基本の使い方】\n` +
    `💬 メッセージを送るだけ！\n→ 自動でメモ保存＆考察\n\n` +
    `【ワークフロー】\n` +
    `📝「メモ」→ メモ入力モード\n` +
    `🧠「仕分け」→ 仕分けワーク\n  （抽象化・具体化・転用）\n` +
    `✅「答え合わせ」→ 前田裕二的分析\n\n` +
    `【その他】\n` +
    `📚「履歴」→ 最近のメモ\n` +
    `📁「マイノート」→ 統計情報\n` +
    `📝「要約 URL」→ 記事を要約\n` +
    `🔄「リセット」→ ワークをやり直し\n\n` +
    `何でも気軽にメモしてください！`;
}

// ─── Process Text Message ───
async function processTextMessage(event: LineEvent) {
  const userId = event.source?.userId;
  const text = event.message?.text?.trim();
  const replyToken = event.replyToken;

  if (!userId || !text || !replyToken) {
    console.log(`[Webhook] Skipping: userId=${userId}, text=${text?.substring(0, 20)}, replyToken=${!!replyToken}`);
    return;
  }

  console.log(`[Webhook] Processing message from ${userId}: "${text.substring(0, 50)}"`);

  // Save user
  try {
    const profile = await getUserProfile(userId);
    await upsertLineUser(userId, profile.displayName);
  } catch (e) {
    console.log(`[Webhook] Could not get profile, saving userId only`);
    await upsertLineUser(userId);
  }

  const session = userSessions.get(userId);
  console.log(`[Webhook] Session state: ${JSON.stringify(session)}`);

  // ─── リセットコマンド（どの状態でも有効） ───
  if (matchesKeyword(text, RESET_KEYWORDS)) {
    userSessions.set(userId, {});
    const response = `🔄 リセットしました！\n\n新しいメモを送ってください。\n何でもOKです！`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  // ─── ヘルプ（どの状態でも有効） ───
  if (matchesKeyword(text, HELP_KEYWORDS)) {
    const response = handleHelp();
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  // ─── ワークフロー中のステップ処理 ───

  // 仕分けワーク中: 抽象化待ち
  if (session?.step === "waiting_abstraction") {
    // スキップまたは答え合わせに進む
    if (matchesKeyword(text, SKIP_KEYWORDS) || matchesKeyword(text, KOTAEAWASE_KEYWORDS)) {
      try {
        const result = await handleKotaeawase(userId);
        await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
        await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
        await replyMessage(replyToken, [textMessage(result)]);
      } catch (err) {
        console.error("[Webhook] Kotaeawase error:", err);
        await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
      }
      return;
    }
    // 抽象化の入力を受け取る
    userSessions.set(userId, { ...session, abstraction: text, step: "waiting_concrete" });
    const response = `🔍 抽象化を受け取りました！\n\n「${text.substring(0, 80)}${text.length > 80 ? "..." : ""}」\n\n次は【具体化】です。\nこの法則が当てはまる\n別の場面を考えてみてください。\n\n---\n「スキップ」で答え合わせに進めます`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  // 仕分けワーク中: 具体化待ち
  if (session?.step === "waiting_concrete") {
    if (matchesKeyword(text, SKIP_KEYWORDS) || matchesKeyword(text, KOTAEAWASE_KEYWORDS)) {
      try {
        const result = await handleKotaeawase(userId);
        await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
        await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
        await replyMessage(replyToken, [textMessage(result)]);
      } catch (err) {
        console.error("[Webhook] Kotaeawase error:", err);
        await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
      }
      return;
    }
    userSessions.set(userId, { ...session, concrete: text, step: "waiting_transfer" });
    const response = `💡 具体例を受け取りました！\n\n「${text.substring(0, 80)}${text.length > 80 ? "..." : ""}」\n\n最後は【転用】です。\nこの気づきを、あなたの仕事や\n生活にどう活かせますか？\n\n---\n「スキップ」で答え合わせに進めます`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  // 仕分けワーク中: 転用待ち
  if (session?.step === "waiting_transfer") {
    if (matchesKeyword(text, SKIP_KEYWORDS) || matchesKeyword(text, KOTAEAWASE_KEYWORDS)) {
      try {
        const result = await handleKotaeawase(userId);
        await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
        await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
        await replyMessage(replyToken, [textMessage(result)]);
      } catch (err) {
        console.error("[Webhook] Kotaeawase error:", err);
        await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
      }
      return;
    }
    // 転用の入力を受け取り、答え合わせへ
    try {
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
    } catch (err) {
      console.error("[Webhook] Kotaeawase error:", err);
      try {
        await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
      } catch {}
    }
    return;
  }

  // 仕分けワーク中: 仕分け待ち（メモ保存済み、仕分けガイド表示済み）
  if (session?.step === "waiting_shiwake") {
    if (matchesKeyword(text, SHIWAKE_KEYWORDS)) {
      try {
        const response = await handleShiwake(userId);
        await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
        await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
        await replyMessage(replyToken, [textMessage(response)]);
      } catch (err) {
        console.error("[Webhook] Shiwake error:", err);
        await replyMessage(replyToken, [textMessage(`エラーが発生しました。もう一度お試しください。`)]);
      }
      return;
    }
    if (matchesKeyword(text, KOTAEAWASE_KEYWORDS)) {
      try {
        const result = await handleKotaeawase(userId);
        await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "workflow_step" });
        await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
        await replyMessage(replyToken, [textMessage(result)]);
      } catch (err) {
        console.error("[Webhook] Kotaeawase error:", err);
        await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
      }
      return;
    }
    // 新しいメモとして扱う（前のセッションをリセット）
  }

  // ─── コマンドマッチング（ワークフロー外） ───

  // 「仕分け」
  if (matchesKeyword(text, SHIWAKE_KEYWORDS)) {
    try {
      const response = await handleShiwake(userId);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(response)]);
    } catch (err) {
      console.error("[Webhook] Shiwake error:", err);
      await replyMessage(replyToken, [textMessage(`エラーが発生しました。もう一度お試しください。`)]);
    }
    return;
  }

  // 「答え合わせ」
  if (matchesKeyword(text, KOTAEAWASE_KEYWORDS)) {
    try {
      const result = await handleKotaeawase(userId);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: result, messageType: "analysis_result" });
      await replyMessage(replyToken, [textMessage(result)]);
    } catch (err) {
      console.error("[Webhook] Kotaeawase error:", err);
      await replyMessage(replyToken, [textMessage(`分析中にエラーが発生しました。もう一度お試しください。`)]);
    }
    return;
  }

  // 「履歴」
  if (matchesKeyword(text, HISTORY_KEYWORDS)) {
    try {
      const response = await handleHistory(userId);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(response)]);
    } catch (err) {
      console.error("[Webhook] History error:", err);
      await replyMessage(replyToken, [textMessage(`エラーが発生しました。もう一度お試しください。`)]);
    }
    return;
  }

  // 「マイノート」
  if (matchesKeyword(text, MYNOTE_KEYWORDS)) {
    try {
      const response = await handleMynote(userId);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(response)]);
    } catch (err) {
      console.error("[Webhook] Mynote error:", err);
      await replyMessage(replyToken, [textMessage(`エラーが発生しました。もう一度お試しください。`)]);
    }
    return;
  }

  // 「要約」
  if (matchesKeyword(text, SUMMARY_KEYWORDS)) {
    try {
      const args = text.replace(/^(要約|ようやく|\/summary)\s*/i, "").trim();
      const response = await handleSummary(args);
      await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
      await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
      await replyMessage(replyToken, [textMessage(response)]);
    } catch (err) {
      console.error("[Webhook] Summary error:", err);
      await replyMessage(replyToken, [textMessage(`エラーが発生しました。もう一度お試しください。`)]);
    }
    return;
  }

  // 「メモ」（明示的にメモモード開始 — ただし実際は不要、下のデフォルト処理で自動保存される）
  if (matchesKeyword(text, MEMO_KEYWORDS) && text.length <= 5) {
    const response = `📝 メモ入力モード\n\n思いついたこと、気づいたこと、\n感じたことを自由に書いてください。\n\n日常の些細なことでもOKです！\n\n---\n💡 実は、そのままメッセージを\n送るだけで自動的にメモとして\n保存されます！`;
    await saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" });
    await saveMessage({ lineUserId: userId, direction: "outgoing", content: response, messageType: "workflow_step" });
    await replyMessage(replyToken, [textMessage(response)]);
    return;
  }

  // ─── デフォルト: 自動メモ保存 → 前田裕二的考察（1回のLLM呼び出しで分類＋応答） ───
  try {
    // メッセージ保存とLLM呼び出しを並行実行（高速化）
    const [, , llmResult] = await Promise.all([
      saveMessage({ lineUserId: userId, direction: "incoming", content: text, messageType: "memo_input" }),
      createMemo({ lineUserId: userId, factContent: text }).catch(e => { console.error("[Webhook] Auto memo save error:", e); return null; }),
      classifyAndReply(text),
    ]);

    const { category, reply } = llmResult;
    const categoryTag = `${CATEGORY_EMOJI[category] || "💬"} ${CATEGORY_LABEL[category] || "一般"}`;

    // セッションにメモ内容を保存（仕分けワークに使う）
    userSessions.set(userId, { factContent: text, step: "waiting_shiwake" });

    const fullReply = `📝 メモを保存しました [${categoryTag}]\n\n${reply}\n\n---\n🧠「仕分け」→ 仕分けワーク開始\n✅「答え合わせ」→ 前田裕二的分析\n💬 続けてメモを送ってもOK！`;

    // 返信とDB保存を並行実行
    await Promise.all([
      replyMessage(replyToken, [textMessage(fullReply)]),
      saveMessage({ lineUserId: userId, direction: "outgoing", content: fullReply, messageType: "analysis_result" }),
    ]);
    console.log(`[Webhook] Auto-memo reply sent (category: ${category})`);
  } catch (err) {
    console.error("[Webhook] Default reply error:", err);
    try {
      await replyMessage(replyToken, [textMessage(`ただいま処理中にエラーが発生しました。\nしばらくしてからもう一度お試しください。`)]);
    } catch {}
  }
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
      `使い方はとってもシンプル:\n\n` +
      `💬 メッセージを送るだけ！\n→ 自動でメモ保存＆考察\n\n` +
      `🧠「仕分け」と送る\n→ 仕分けワーク開始\n\n` +
      `✅「答え合わせ」と送る\n→ 前田裕二的な分析\n\n` +
      `さあ、今日から「メモの魔力」で\n新しい発見を始めましょう！`;
    await replyMessage(event.replyToken, [textMessage(welcomeMessage)]);
  }
}

// ─── Register Webhook Route ───
export function registerWebhookRoute(app: Express) {
  // IMPORTANT: Use express.raw() for the webhook endpoint to get the raw body
  // This is required for LINE signature verification, which needs the exact bytes
  // that LINE sent, not a re-serialized JSON string.
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      console.log(`[Webhook] POST /api/webhook received`);

      const signature = req.headers["x-line-signature"] as string;
      if (!signature) {
        console.warn("[Webhook] Missing x-line-signature header");
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      // req.body is a Buffer when using express.raw()
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

      console.log(`[Webhook] Signature verification: rawBody length=${rawBody.length}`);

      if (!verifyLineSignature(rawBody, signature)) {
        console.warn("[Webhook] Invalid signature");
        res.status(403).json({ error: "Invalid signature" });
        return;
      }

      console.log(`[Webhook] Signature verified successfully`);

      const body: WebhookBody = JSON.parse(rawBody);
      console.log(`[Webhook] Received ${body.events?.length ?? 0} events`);

      // Respond immediately to LINE
      res.status(200).json({ status: "ok" });

      // Process events asynchronously
      for (const event of body.events || []) {
        try {
          console.log(`[Webhook] Processing event: type=${event.type}`);
          switch (event.type) {
            case "message":
              if (event.message?.type === "text") {
                await processTextMessage(event);
              } else {
                console.log(`[Webhook] Non-text message type: ${event.message?.type}`);
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

  console.log("[Webhook] Route registered: POST /api/webhook");
}
