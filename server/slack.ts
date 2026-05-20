import crypto from "crypto";
import express, { type Express, type Request, type Response } from "express";
import { createMemo, getMemos, saveMessage } from "./db";
import { ENV } from "./_core/env";
import { classifyAndReply, generateDailyMemoSummary, generateKotaeawase, summarizeArticle } from "./llm-handlers";
import { extractUrl, scrapeUrl } from "./scraper";

type SlackEvent = {
  type?: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
  channel_type?: string;
};

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: SlackEvent;
};

type SlackCommand = {
  teamId: string;
  userId: string;
  channelId: string;
  text: string;
  responseUrl: string;
};

const HELP_KEYWORDS = ["help", "ヘルプ", "使い方"];
const HISTORY_KEYWORDS = ["history", "履歴", "メモ履歴"];
const ANSWER_KEYWORDS = ["answer", "kotaeawase", "答え合わせ", "答合わせ"];
const SUMMARY_KEYWORDS = ["summary", "要約"];
const DAILY_SUMMARY_KEYWORDS = ["daily", "daily summary", "今日のまとめ", "今日まとめ", "日報", "振り返り"];
const MEMO_KEYWORDS = ["memo", "メモ"];

type MemoFolderId = "investment" | "thought" | "idea" | "learning" | "task" | "general";

type MemoFolder = {
  id: MemoFolderId;
  label: string;
  icon: string;
  aliases: string[];
  keywords: string[];
};

const MEMO_FOLDERS: MemoFolder[] = [
  {
    id: "investment",
    label: "投資メモ",
    icon: "📈",
    aliases: ["投資メモ", "投資", "株", "相場", "investment"],
    keywords: ["投資", "株", "米国株", "日本株", "fx", "為替", "ドル", "円", "金利", "債券", "etf", "nasdaq", "sp500", "s&p", "ビットコイン", "btc", "決算", "銘柄", "チャート", "相場", "資産", "配当", "nisa", "トレード", "ゴールド", "xau"],
  },
  {
    id: "idea",
    label: "アイデア",
    icon: "💡",
    aliases: ["アイデア", "アイディア", "idea"],
    keywords: ["アイデア", "アイディア", "思いついた", "企画", "サービス", "アプリ", "ネタ", "案", "改善案", "作れそう", "できそう", "ひらめき"],
  },
  {
    id: "task",
    label: "タスク",
    icon: "✅",
    aliases: ["タスク", "todo", "to do", "やること"],
    keywords: ["todo", "to do", "タスク", "やること", "確認する", "連絡する", "予約", "提出", "期限", "締切", "買う", "作る", "送る", "調べる", "対応", "完了", "依頼"],
  },
  {
    id: "learning",
    label: "学び",
    icon: "📚",
    aliases: ["学び", "学習", "learning", "勉強"],
    keywords: ["学び", "学んだ", "勉強", "読書", "本", "講座", "知った", "理解", "学習", "授業", "教材", "インプット"],
  },
  {
    id: "thought",
    label: "思考",
    icon: "🧠",
    aliases: ["思考", "考え", "内省", "thought"],
    keywords: ["思考", "考え", "感じた", "なぜ", "問い", "悩み", "仮説", "内省", "気持ち", "価値観", "違和感", "モヤモヤ"],
  },
  {
    id: "general",
    label: "その他",
    icon: "💬",
    aliases: ["その他", "一般", "general"],
    keywords: [],
  },
];

const MEMO_FOLDER_BY_ID = new Map(MEMO_FOLDERS.map(folder => [folder.id, folder]));

export function verifySlackSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
  secret = ENV.slackSigningSecret
): boolean {
  if (!secret || !timestamp || !signature) return false;

  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTime) > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

function verifyRequest(req: Request, rawBody: string): boolean {
  return verifySlackSignature(
    rawBody,
    req.headers["x-slack-request-timestamp"] as string | undefined,
    req.headers["x-slack-signature"] as string | undefined
  );
}

function slackUserKey(teamId: string | undefined, userId: string): string {
  return `slack:${teamId || "unknown"}:${userId}`;
}

function cleanSlackText(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/gi, "").trim();
}

function getMemoFolder(folderId: MemoFolderId): MemoFolder {
  return MEMO_FOLDER_BY_ID.get(folderId) ?? MEMO_FOLDERS[MEMO_FOLDERS.length - 1];
}

function normalizeMemoFolderId(category: string | undefined): MemoFolderId | null {
  if (!category) return null;
  if (MEMO_FOLDER_BY_ID.has(category as MemoFolderId)) return category as MemoFolderId;
  if (category === "business") return "task";
  if (category === "personal") return "thought";
  return null;
}

export function classifyMemoFolder(text: string, category?: string): MemoFolderId {
  const normalized = text.toLowerCase();
  const scored = MEMO_FOLDERS
    .filter(folder => folder.id !== "general")
    .map(folder => ({
      folder,
      score: folder.keywords.reduce((score, keyword) => normalized.includes(keyword.toLowerCase()) ? score + 1 : score, 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].folder.id;
  return normalizeMemoFolderId(category) ?? "general";
}

function resolveMemoFolderFilter(text: string, commandKeywords: string[]): MemoFolder | null {
  const filterText = stripKeyword(text, commandKeywords)?.trim();
  if (!filterText) return null;

  const normalized = filterText.toLowerCase();
  return MEMO_FOLDERS.find(folder =>
    folder.aliases.some(alias => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase()))
  ) ?? null;
}

function memoFolderTag(folderId: MemoFolderId): string {
  const folder = getMemoFolder(folderId);
  return `${folder.icon} ${folder.label}`;
}

export function shouldHandleSlackEvent(event: SlackEvent, memoChannelId = ENV.slackMemoChannelId): boolean {
  if (event.bot_id || event.subtype) return false;
  if (!event.user || !event.text || !event.channel) return false;
  if (event.type === "app_mention") return true;
  if (event.type !== "message") return false;
  if (event.channel_type === "im") return true;
  return Boolean(memoChannelId && event.channel === memoChannelId);
}

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase().trim();
  return keywords.some(kw => lower === kw || lower.startsWith(`${kw.toLowerCase()} `) || lower.startsWith(`${kw.toLowerCase()}　`));
}

function stripKeyword(text: string, keywords: string[]): string | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  for (const keyword of [...keywords].sort((a, b) => b.length - a.length)) {
    const normalized = keyword.toLowerCase();
    if (lower === normalized) return "";
    if (lower.startsWith(`${normalized} `) || lower.startsWith(`${normalized}　`)) {
      return trimmed.slice(keyword.length).trim();
    }
  }
  return null;
}

function truncateForSlack(text: string, maxLength = 2800): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 20)}\n\n...省略しました`;
}

function jstDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function jstDateLabel(date: Date): string {
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function helpText(): string {
  return [
    "📖 メモの魔力 Slack Bot",
    "",
    "メンション、DM、またはSlash Commandで使えます。",
    "",
    "・普通に送る: メモ保存 + 前田裕二的な考察",
    "・履歴 / history: 最近のメモを表示",
    "・履歴 投資メモ: 分類別に最近のメモを表示",
    "・答え合わせ / answer: 最新メモを分析",
    "・今日のまとめ / 日報: 今日のメモを要約",
    "・今日のまとめ アイデア: 分類別に今日のメモを要約",
    "・要約 URL / summary URL: 記事や文章を要約",
    "・ヘルプ / help: この案内を表示",
  ].join("\n");
}

async function handleHistory(userKey: string, text: string): Promise<string> {
  const folderFilter = resolveMemoFolderFilter(text, HISTORY_KEYWORDS);
  const memos = (await getMemos(userKey, folderFilter ? 50 : 5))
    .filter(memo => !folderFilter || classifyMemoFolder(memo.factContent) === folderFilter.id)
    .slice(0, 5);

  if (memos.length === 0) {
    const suffix = folderFilter ? `「${folderFilter.label}」のメモがまだありません。` : "まだSlackから保存されたメモがありません。";
    return `📚 ${suffix}\nまず #メモ に普通に書いてください。`;
  }

  const lines = memos.map((memo, index) => {
    const date = new Date(memo.createdAt).toLocaleDateString("ja-JP");
    const preview = memo.factContent.slice(0, 80) + (memo.factContent.length > 80 ? "..." : "");
    return `${index + 1}. ${date} ${memoFolderTag(classifyMemoFolder(memo.factContent))}\n${preview}`;
  });

  const title = folderFilter ? `📚 最近のメモ: ${folderFilter.icon} ${folderFilter.label}` : "📚 最近のメモ";
  return `${title}\n\n${lines.join("\n\n")}`;
}

async function handleAnswer(userKey: string): Promise<string> {
  const [latest] = await getMemos(userKey, 1);
  if (!latest) {
    return "✅ 答え合わせするメモがまだありません。\nまず普通にメッセージを送ってください。";
  }

  const response = await generateKotaeawase(latest.factContent);
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
}

async function handleSummary(text: string): Promise<string> {
  const input = stripKeyword(text, SUMMARY_KEYWORDS) ?? "";
  if (!input) {
    return "📝 要約したいURLまたは文章を続けて送ってください。\n例: 要約 https://example.com/article";
  }

  const url = extractUrl(input);
  if (!url) return summarizeArticle(input);

  const article = await scrapeUrl(url);
  return summarizeArticle(`タイトル: ${article.title}\n\n${article.content}`, article.url);
}

async function handleDailySummary(userKey: string, text: string): Promise<string> {
  const folderFilter = resolveMemoFolderFilter(text, DAILY_SUMMARY_KEYWORDS);
  const today = new Date();
  const todayKey = jstDateKey(today);
  const todaysMemos = (await getMemos(userKey, 100))
    .filter(memo => jstDateKey(new Date(memo.createdAt)) === todayKey)
    .filter(memo => !folderFilter || classifyMemoFolder(memo.factContent) === folderFilter.id)
    .reverse();

  const response = await generateDailyMemoSummary(
    todaysMemos.map(memo => memo.factContent),
    folderFilter ? `${jstDateLabel(today)} ${folderFilter.icon} ${folderFilter.label}` : jstDateLabel(today)
  );
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
}

async function handleMemo(userKey: string, text: string): Promise<string> {
  const explicitMemo = stripKeyword(text, MEMO_KEYWORDS);
  const memoText = explicitMemo === null ? text.trim() : explicitMemo.trim();
  if (!memoText) {
    return "📝 メモしたい内容を続けて送ってください。\n例: メモ 朝の会議で、質問が少ないほど理解度が低いと感じた";
  }

  const [, , llmResult] = await Promise.all([
    saveMessage({ lineUserId: userKey, direction: "incoming", content: memoText, messageType: "memo_input" }),
    createMemo({ lineUserId: userKey, factContent: memoText }).catch(error => {
      console.error("[Slack] Failed to save memo:", error);
      return null;
    }),
    classifyAndReply(memoText),
  ]);
  const folderId = classifyMemoFolder(memoText, llmResult.category);

  const response = `📝 メモを保存しました [${memoFolderTag(folderId)}]\n\n${llmResult.reply}\n\n---\n「履歴 ${getMemoFolder(folderId).label}」で分類別に見られます。\n「答え合わせ」で最新メモを深掘りできます。`;
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
}

async function handleSlackText(teamId: string | undefined, userId: string, text: string): Promise<string> {
  const userKey = slackUserKey(teamId, userId);
  const cleanedText = cleanSlackText(text);

  if (!cleanedText || matchesKeyword(cleanedText, HELP_KEYWORDS)) return helpText();
  if (matchesKeyword(cleanedText, HISTORY_KEYWORDS)) return handleHistory(userKey, cleanedText);
  if (matchesKeyword(cleanedText, ANSWER_KEYWORDS)) return handleAnswer(userKey);
  if (matchesKeyword(cleanedText, DAILY_SUMMARY_KEYWORDS)) return handleDailySummary(userKey, cleanedText);
  if (matchesKeyword(cleanedText, SUMMARY_KEYWORDS)) return handleSummary(cleanedText);

  return handleMemo(userKey, cleanedText);
}

async function postSlackMessage(channel: string, text: string, threadTs?: string) {
  if (!ENV.slackBotToken) {
    console.warn("[Slack] SLACK_BOT_TOKEN is not configured");
    return;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${ENV.slackBotToken}`,
    },
    body: JSON.stringify({
      channel,
      text: truncateForSlack(text),
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }),
  });

  const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !result?.ok) {
    console.error("[Slack] chat.postMessage failed:", result?.error || response.statusText);
  }
}

async function respondToCommand(responseUrl: string, text: string) {
  if (!responseUrl) return;

  await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text: truncateForSlack(text),
    }),
  }).catch(error => {
    console.error("[Slack] response_url post failed:", error);
  });
}

async function handleSlackCommand(command: SlackCommand): Promise<string> {
  if (!command.userId) return "SlackユーザーIDを取得できませんでした。";
  return handleSlackText(command.teamId, command.userId, command.text || "help");
}

export function registerSlackRoutes(app: Express) {
  app.post("/api/slack/events", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const rawBody = getRawBody(req);
    if (!verifyRequest(req, rawBody)) {
      res.status(401).send("Invalid Slack signature");
      return;
    }

    const body = JSON.parse(rawBody) as SlackEventEnvelope;
    if (body.type === "url_verification" && body.challenge) {
      res.status(200).send(body.challenge);
      return;
    }

    if (req.headers["x-slack-retry-num"]) {
      res.status(200).send();
      return;
    }

    res.status(200).send();

    const event = body.event;
    if (!event || !shouldHandleSlackEvent(event)) return;

    const channel = event.channel!;
    const user = event.user!;
    const text = event.text!;
    const threadTs =
      event.thread_ts ||
      (event.type === "app_mention" || event.channel === ENV.slackMemoChannelId ? event.ts : undefined);
    void handleSlackText(body.team_id, user, text)
      .then(response => postSlackMessage(channel, response, threadTs))
      .catch(error => {
        console.error("[Slack] Event handling failed:", error);
        return postSlackMessage(channel, "処理中にエラーが発生しました。もう一度お試しください。", threadTs);
      });
  });

  app.post("/api/slack/commands", express.raw({ type: "application/x-www-form-urlencoded" }), async (req: Request, res: Response) => {
    const rawBody = getRawBody(req);
    if (!verifyRequest(req, rawBody)) {
      res.status(401).send("Invalid Slack signature");
      return;
    }

    const params = new URLSearchParams(rawBody);
    const command: SlackCommand = {
      teamId: params.get("team_id") || "",
      userId: params.get("user_id") || "",
      channelId: params.get("channel_id") || "",
      text: params.get("text") || "",
      responseUrl: params.get("response_url") || "",
    };

    res.status(200).json({
      response_type: "ephemeral",
      text: "受け付けました。少し待ってください。",
    });

    void handleSlackCommand(command)
      .then(response => respondToCommand(command.responseUrl, response))
      .catch(error => {
        console.error("[Slack] Command handling failed:", error);
        return respondToCommand(command.responseUrl, "処理中にエラーが発生しました。もう一度お試しください。");
      });
  });

  app.get("/api/slack/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "Slack endpoints are active" });
  });

  console.log("[Slack] Routes registered: POST /api/slack/events, POST /api/slack/commands");
}
