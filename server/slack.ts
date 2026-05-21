import crypto from "crypto";
import express, { type Express, type Request, type Response } from "express";
import { createMemo, getMemoById, getMemos, getMessagesByUser, saveMessage, updateMemoFactContent } from "./db";
import { ENV } from "./_core/env";
import {
  classifyAndReply,
  generateArticleDraftFromThread,
  generateCopyReadySectionsFromThread,
  generateDailyMemoSummary,
  generateImportantThreadSummary,
  generateKotaeawase,
  generatePhraseExtractsFromThread,
  generateThreadConversationReply,
  generateXPostDraftFromThread,
  summarizeArticle,
  type CopyReadySections,
  type ThreadConversationTurn,
} from "./llm-handlers";
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

type SlackHandlingContext = {
  channelId?: string;
  threadTs?: string;
  isThreadReply?: boolean;
};

type SlackThreadContextRecord = {
  type: "slack_thread_context";
  channelId: string;
  threadTs: string;
  memoId: number;
  rootText: string;
  folderId: MemoFolderId;
  createdAt: string;
};

type SlackThreadTurnRecord = {
  type: "slack_thread_turn";
  channelId: string;
  threadTs: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type SlackPhraseCandidateRecord = {
  type: "slack_phrase_candidates";
  channelId: string;
  threadTs: string;
  phrases: string[];
  createdAt: string;
};

type SlackThreadRecord = SlackThreadContextRecord | SlackThreadTurnRecord | SlackPhraseCandidateRecord;

const HELP_KEYWORDS = ["help", "ヘルプ", "使い方", "できること", "機能", "機能一覧", "コマンド"];
const HISTORY_KEYWORDS = ["history", "履歴", "メモ履歴"];
const ANSWER_KEYWORDS = ["answer", "kotaeawase", "答え合わせ", "答合わせ"];
const SUMMARY_KEYWORDS = ["summary", "要約"];
const ORGANIZE_KEYWORDS = ["整理", "棚卸し", "棚卸", "片付け", "片づけ"];
const ARTICLE_KEYWORDS = ["article", "記事化", "note化", "ブログ化", "下書き"];
const X_POST_KEYWORDS = ["x", "x化", "post", "ポスト化", "投稿化", "ツイート化", "x投稿"];
const COPY_KEYWORDS = ["copy", "コピー", "コピー用", "コピペ", "コピペ用"];
const PHRASE_KEYWORDS = ["言葉", "ことば", "表現", "フレーズ", "刺さる言葉"];
const IMPORTANT_SUMMARY_KEYWORDS = ["重要", "重要まとめ", "要点まとめ", "抜粋まとめ", "別スレッド", "まとめる"];
const DAILY_SUMMARY_KEYWORDS = ["daily", "daily summary", "今日のまとめ", "今日まとめ", "日報", "振り返り"];
const MEMO_KEYWORDS = ["memo", "メモ"];
const APPEND_PREFIXES = ["追記:", "追記：", "追加:", "追加：", "補足:", "補足："];
const NEW_MEMO_PREFIXES = ["別メモ:", "別メモ：", "新規メモ:", "新規メモ：", "new memo:", "new memo："];

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

type ThreadReplyIntent =
  | { mode: "continue"; text: string }
  | { mode: "append"; text: string }
  | { mode: "new_memo"; text: string };

function stripAnyPrefix(text: string, prefixes: string[]): string | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  for (const prefix of prefixes) {
    const normalized = prefix.toLowerCase();
    if (lower.startsWith(normalized)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return null;
}

export function parseThreadReplyIntent(text: string): ThreadReplyIntent {
  const newMemoText = stripAnyPrefix(text, NEW_MEMO_PREFIXES);
  if (newMemoText !== null) return { mode: "new_memo", text: newMemoText };

  const appendText = stripAnyPrefix(text, APPEND_PREFIXES);
  if (appendText !== null) return { mode: "append", text: appendText };

  const explicitMemoText = stripKeyword(text, MEMO_KEYWORDS);
  if (explicitMemoText !== null) return { mode: "new_memo", text: explicitMemoText };

  return { mode: "continue", text: text.trim() };
}

function serializeThreadRecord(record: SlackThreadRecord): string {
  return JSON.stringify(record);
}

function parseThreadRecord(content: string): SlackThreadRecord | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (
      parsed?.type === "slack_thread_context" &&
      typeof parsed.channelId === "string" &&
      typeof parsed.threadTs === "string" &&
      typeof parsed.memoId === "number" &&
      typeof parsed.rootText === "string" &&
      typeof parsed.folderId === "string"
    ) {
      return parsed as SlackThreadContextRecord;
    }
    if (
      parsed?.type === "slack_thread_turn" &&
      typeof parsed.channelId === "string" &&
      typeof parsed.threadTs === "string" &&
      (parsed.role === "user" || parsed.role === "assistant") &&
      typeof parsed.text === "string"
    ) {
      return parsed as SlackThreadTurnRecord;
    }
    if (
      parsed?.type === "slack_phrase_candidates" &&
      typeof parsed.channelId === "string" &&
      typeof parsed.threadTs === "string" &&
      Array.isArray(parsed.phrases)
    ) {
      return {
        ...parsed,
        phrases: parsed.phrases.filter((phrase): phrase is string => typeof phrase === "string"),
      } as SlackPhraseCandidateRecord;
    }
  } catch {
    return null;
  }
  return null;
}

async function saveThreadContext(
  userKey: string,
  channelId: string,
  threadTs: string,
  memoId: number,
  rootText: string,
  folderId: MemoFolderId
) {
  const record: SlackThreadContextRecord = {
    type: "slack_thread_context",
    channelId,
    threadTs,
    memoId,
    rootText,
    folderId,
    createdAt: new Date().toISOString(),
  };
  await saveMessage({
    lineUserId: userKey,
    direction: "outgoing",
    content: serializeThreadRecord(record),
    messageType: "workflow_step",
  });
}

async function saveThreadTurn(
  userKey: string,
  channelId: string,
  threadTs: string,
  role: "user" | "assistant",
  text: string
) {
  const record: SlackThreadTurnRecord = {
    type: "slack_thread_turn",
    channelId,
    threadTs,
    role,
    text,
    createdAt: new Date().toISOString(),
  };
  await saveMessage({
    lineUserId: userKey,
    direction: role === "user" ? "incoming" : "outgoing",
    content: serializeThreadRecord(record),
    messageType: "workflow_step",
  });
}

async function savePhraseCandidates(
  userKey: string,
  channelId: string,
  threadTs: string,
  phrases: string[]
) {
  const record: SlackPhraseCandidateRecord = {
    type: "slack_phrase_candidates",
    channelId,
    threadTs,
    phrases,
    createdAt: new Date().toISOString(),
  };
  await saveMessage({
    lineUserId: userKey,
    direction: "outgoing",
    content: serializeThreadRecord(record),
    messageType: "workflow_step",
  });
}

async function getThreadContext(userKey: string, channelId: string, threadTs: string) {
  const records = (await getMessagesByUser(userKey, 400))
    .map(message => parseThreadRecord(message.content))
    .filter((record): record is SlackThreadRecord =>
      Boolean(record && record.channelId === channelId && record.threadTs === threadTs)
    );

  const context = records.find((record): record is SlackThreadContextRecord => record.type === "slack_thread_context");
  if (!context) return null;

  const turns = records
    .filter((record): record is SlackThreadTurnRecord => record.type === "slack_thread_turn")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const phraseCandidates = records
    .filter((record): record is SlackPhraseCandidateRecord => record.type === "slack_phrase_candidates")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.phrases ?? [];

  return { context, turns, phraseCandidates };
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

function formatCopyReadyMessages(sections: CopyReadySections): string[] {
  return [
    `【タイトル】\n${sections.title}`,
    `【大事な一文】\n${sections.keySentence}`,
    `【短い本文】\n${sections.shortMemo}`,
    `【X投稿】\n${sections.xPost}`,
    `【次にやること】\n${sections.nextAction}`,
  ];
}

function formatCopyReadyRootPost(sections: CopyReadySections): string {
  return [
    "📋 コピー用まとめ",
    "",
    ...formatCopyReadyMessages(sections),
    "",
    "この投稿のスレッドで、さらに整えられます。",
  ].join("\n\n");
}

function formatPhraseCandidates(phrases: string[]): string {
  return [
    "📌 言葉まとめ",
    "",
    "使えそうな言葉を抜き出しました。",
    "深掘りしたいものがあれば、この投稿のスレッドで「言葉1」のように送ってください。",
    "",
    ...phrases.map((phrase, index) => `${index + 1}. ${phrase}`),
  ].join("\n");
}

export function parsePhraseSelection(text: string): number | null {
  const normalized = text.trim().toLowerCase();
  const match = normalized.match(/^(?:言葉|ことば|表現|フレーズ)\s*([1-8１-８])$/);
  if (!match) return null;

  const digit = match[1].replace(/[１-８]/g, char => String(char.charCodeAt(0) - "１".charCodeAt(0) + 1));
  const index = Number(digit) - 1;
  return Number.isInteger(index) && index >= 0 && index < 8 ? index : null;
}

function jstDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function jstDateLabel(date: Date): string {
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function jstWeekStartKey(date: Date): string {
  const jst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const day = jst.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  jst.setDate(jst.getDate() + diff);
  return jst.toLocaleDateString("sv-SE");
}

function isGeneratedMemo(content: string): boolean {
  return content.startsWith("📌 言葉メモ") || content.startsWith("📌 言葉まとめ") || content.startsWith("📌 重要まとめ") || content.startsWith("📋 コピー用まとめ");
}

export function parseOrganizeScope(text: string): "today" | "week" | "unprocessed" | "recent" {
  const normalized = text.toLowerCase();
  if (normalized.includes("今日") || normalized.includes("today")) return "today";
  if (normalized.includes("今週") || normalized.includes("week")) return "week";
  if (normalized.includes("未処理") || normalized.includes("そのまま") || normalized.includes("まだ")) return "unprocessed";
  return "recent";
}

function formatOrganizeMemoPreview(text: string): string {
  const compact = text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 64 ? `${compact.slice(0, 64)}...` : compact;
}

function helpText(): string {
  return [
    "📖 メモBotでできること",
    "",
    "#メモ は入口です。分類を考えずに、まず普通に書いてください。",
    "整理はあとからBotが手伝います。",
    "",
    "【あとで散らかりを見たい】",
    "整理",
    "→ 最近のメモを 投資メモ / 思考 / アイデア / 学び / タスク に分けて表示します。",
    "",
    "整理 今日",
    "→ 今日のメモだけを分けて表示します。",
    "",
    "整理 今週",
    "→ 今週のメモだけを分けて表示します。",
    "",
    "整理 未処理",
    "→ コピー用・言葉まとめ・重要まとめを除いて、まだ素材のまま残っていそうなメモを表示します。",
    "",
    "そのBot返信のスレッドでは、次の言葉を送ると育てられます。",
    "",
    "【コピーしたい】",
    "コピー用",
    "→ タイトル / 大事な一文 / 短い本文 / X投稿 / 次にやること を、新しい投稿に分けて出します。",
    "",
    "【気に入った表現だけ残したい】",
    "言葉",
    "→ スレッドから、使えそうな短い表現だけを番号つきの新しい投稿にします。",
    "",
    "言葉1",
    "→ 1番の言葉を #メモ に新しい投稿として作ります。そこから別スレッドで深掘りできます。",
    "例: 言葉2、言葉3 も使えます。",
    "",
    "【大事な部分だけ別に育てたい】",
    "重要",
    "→ 今のスレッドの大事な部分を、#メモ に新しい親投稿としてまとめます。",
    "",
    "【発信用に整えたい】",
    "記事化",
    "→ スレッド内容を記事下書きにします。",
    "",
    "X化",
    "→ X投稿用に短く整えます。",
    "",
    "【あとで見る】",
    "履歴",
    "→ 最近のメモを表示します。",
    "",
    "今日のまとめ",
    "→ 今日のメモをまとめます。",
    "",
    "【スレッドで会話を続ける】",
    "普通に返信",
    "→ 元メモの続きとして会話できます。",
    "",
    "追記: 内容",
    "→ 元メモに追記します。",
    "",
    "別メモ: 内容",
    "→ スレッド内でも新しいメモとして保存します。",
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

async function handleOrganize(userKey: string, text: string): Promise<string> {
  const scope = parseOrganizeScope(text);
  const now = new Date();
  const todayKey = jstDateKey(now);
  const weekStartKey = jstWeekStartKey(now);
  const allMemos = await getMemos(userKey, 200);
  const sourceMemos = allMemos.filter(memo => !isGeneratedMemo(memo.factContent));

  const scopedMemos = sourceMemos.filter(memo => {
    const memoDate = new Date(memo.createdAt);
    if (scope === "today") return jstDateKey(memoDate) === todayKey;
    if (scope === "week") return jstWeekStartKey(memoDate) === weekStartKey;
    return true;
  });

  const limitedMemos = scopedMemos.slice(0, scope === "recent" ? 50 : 120);
  if (limitedMemos.length === 0) {
    return [
      "🗂 整理するメモがまだありません。",
      "",
      "#メモ に普通に書けば、あとから「整理」で拾えます。",
    ].join("\n");
  }

  const grouped = new Map<MemoFolderId, typeof limitedMemos>();
  for (const folder of MEMO_FOLDERS) grouped.set(folder.id, []);
  for (const memo of limitedMemos) {
    const folderId = classifyMemoFolder(memo.factContent);
    grouped.get(folderId)?.push(memo);
  }

  const titleByScope: Record<ReturnType<typeof parseOrganizeScope>, string> = {
    today: "今日の整理",
    week: "今週の整理",
    unprocessed: "未処理っぽいメモ",
    recent: "最近の整理",
  };

  const blocks = MEMO_FOLDERS
    .map(folder => {
      const memos = grouped.get(folder.id) ?? [];
      if (memos.length === 0) return null;
      const lines = memos.slice(0, 3).map((memo, index) => {
        const date = new Date(memo.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
        return `${index + 1}. ${date} ${formatOrganizeMemoPreview(memo.factContent)}`;
      });
      const hiddenCount = memos.length > 3 ? `\nほか ${memos.length - 3}件` : "";
      return `${folder.icon} ${folder.label}（${memos.length}件）\n${lines.join("\n")}${hiddenCount}`;
    })
    .filter((block): block is string => Boolean(block));

  const scopeNote = scope === "unprocessed"
    ? "コピー用・言葉まとめ・重要まとめを除いた、素材のまま残っていそうなメモです。"
    : "#メモ は入口のままでOK。分類はあとから見れば大丈夫です。";

  return [
    `🗂 ${titleByScope[scope]}`,
    scopeNote,
    "",
    ...blocks,
    "",
    "次に使う言葉:",
    "重要 → 大事な部分を別投稿にする",
    "言葉 → 気に入った表現だけ抜く",
    "コピー用 → コピーしやすく短く分ける",
  ].join("\n\n");
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

async function handleLatestArticleDraft(userKey: string): Promise<string> {
  const [latest] = await getMemos(userKey, 1);
  if (!latest) {
    return "記事化するメモがまだありません。\nまず #メモ に普通に書くか、Bot返信のスレッドで「記事化」と送ってください。";
  }

  const response = await generateArticleDraftFromThread(latest.factContent, []);
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
}

async function handleLatestXPostDraft(userKey: string): Promise<string> {
  const [latest] = await getMemos(userKey, 1);
  if (!latest) {
    return "X投稿化するメモがまだありません。\nまず #メモ に普通に書くか、Bot返信のスレッドで「X化」と送ってください。";
  }

  const response = await generateXPostDraftFromThread(latest.factContent, []);
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
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

async function handleMemo(userKey: string, text: string, context?: SlackHandlingContext): Promise<string> {
  const explicitMemo = stripKeyword(text, MEMO_KEYWORDS);
  const memoText = explicitMemo === null ? text.trim() : explicitMemo.trim();
  if (!memoText) {
    return "📝 メモしたい内容を続けて送ってください。\n例: メモ 朝の会議で、質問が少ないほど理解度が低いと感じた";
  }

  const [, createdMemo, llmResult] = await Promise.all([
    saveMessage({ lineUserId: userKey, direction: "incoming", content: memoText, messageType: "memo_input" }),
    createMemo({ lineUserId: userKey, factContent: memoText }).catch(error => {
      console.error("[Slack] Failed to save memo:", error);
      return null;
    }),
    classifyAndReply(memoText),
  ]);
  const folderId = classifyMemoFolder(memoText, llmResult.category);

  if (context?.channelId && context.threadTs && createdMemo?.id) {
    await saveThreadContext(userKey, context.channelId, context.threadTs, createdMemo.id, memoText, folderId);
  }

  const response = `📝 [${memoFolderTag(folderId)}]\n\n${llmResult.reply}\n\n---\n「履歴 ${getMemoFolder(folderId).label}」で分類別に見られます。\n「答え合わせ」で最新メモを深掘りできます。`;
  await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
  return response;
}

async function handleThreadReply(userKey: string, cleanedText: string, context: SlackHandlingContext): Promise<string> {
  if (!context.channelId || !context.threadTs) {
    return "このスレッドの情報を取得できませんでした。新しいメモとして保存する場合は #メモ に普通に投稿してください。";
  }

  const intent = parseThreadReplyIntent(cleanedText);
  if (intent.mode === "new_memo") {
    return handleMemo(userKey, intent.text || cleanedText);
  }

  const thread = await getThreadContext(userKey, context.channelId, context.threadTs);
  if (!thread) {
    return [
      "このスレッドの元メモがまだ見つかりません。",
      "新しい #メモ 投稿から始めると、次の返信から会話がつながります。",
      "別メモとして保存したい場合は「別メモ: 内容」と送ってください。",
    ].join("\n");
  }

  const memo = await getMemoById(thread.context.memoId);
  const parentMemo = memo?.factContent || thread.context.rootText;

  if (intent.mode === "append") {
    if (!intent.text) return "追記したい内容を「追記: 内容」の形で送ってください。";
    const updatedMemo = `${parentMemo}\n\n追記: ${intent.text}`;
    if (memo?.id) await updateMemoFactContent(memo.id, updatedMemo);
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", `追記: ${intent.text}`);

    const response = [
      "📝 追記しました。",
      "",
      "このスレッドでは、次からこの追記も踏まえて返します。",
      "別のメモにしたい時は「別メモ: 内容」と送ってください。",
    ].join("\n");
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", response);
    return response;
  }

  if (matchesKeyword(cleanedText, ANSWER_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const response = await generateKotaeawase(parentMemo);
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", response);
    return response;
  }

  if (matchesKeyword(cleanedText, ARTICLE_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
      role: turn.role,
      content: turn.text,
    }));
    const response = await generateArticleDraftFromThread(parentMemo, conversation);
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", response);
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
    return response;
  }

  if (matchesKeyword(cleanedText, X_POST_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
      role: turn.role,
      content: turn.text,
    }));
    const response = await generateXPostDraftFromThread(parentMemo, conversation);
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", response);
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });
    return response;
  }

  const selectedPhraseIndex = parsePhraseSelection(cleanedText);
  if (selectedPhraseIndex !== null) {
    const phrase = thread.phraseCandidates[selectedPhraseIndex];
    if (!phrase) {
      return "その番号の言葉が見つかりませんでした。先にこのスレッドで「言葉」と送ってください。";
    }

    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const phraseMemo = [
      "📌 言葉メモ",
      "",
      phrase,
      "",
      "この言葉をここから深掘りできます。",
    ].join("\n");
    const createdMemo = await createMemo({ lineUserId: userKey, factContent: phraseMemo }).catch(error => {
      console.error("[Slack] Failed to save phrase memo:", error);
      return null;
    });
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: phraseMemo, messageType: "analysis_result" });

    const rootTs = await postSlackMessage(context.channelId, phraseMemo);
    if (createdMemo?.id && rootTs) {
      await saveThreadContext(userKey, context.channelId, rootTs, createdMemo.id, phraseMemo, thread.context.folderId);
    }

    const ack = rootTs
      ? `「${phrase}」を新しい投稿にしました。`
      : "言葉メモを作りましたが、Slackへの投稿に失敗しました。少ししてからもう一度試してください。";
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", ack);
    return ack;
  }

  if (matchesKeyword(cleanedText, PHRASE_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
      role: turn.role,
      content: turn.text,
    }));
    const phrases = await generatePhraseExtractsFromThread(parentMemo, conversation);
    await savePhraseCandidates(userKey, context.channelId, context.threadTs, phrases);

    const phrasePost = formatPhraseCandidates(phrases);
    const createdMemo = await createMemo({ lineUserId: userKey, factContent: phrasePost }).catch(error => {
      console.error("[Slack] Failed to save phrase candidates:", error);
      return null;
    });
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: phrasePost, messageType: "analysis_result" });

    const rootTs = await postSlackMessage(context.channelId, phrasePost);
    if (createdMemo?.id && rootTs) {
      await saveThreadContext(userKey, context.channelId, rootTs, createdMemo.id, phrasePost, thread.context.folderId);
      await savePhraseCandidates(userKey, context.channelId, rootTs, phrases);
    }

    const response = rootTs
      ? "言葉まとめを新しい投稿にしました。気になるものは、その投稿のスレッドで「言葉1」のように送れます。"
      : "言葉まとめを作りましたが、Slackへの投稿に失敗しました。少ししてからもう一度試してください。";
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", `${phrasePost}\n\n${response}`);
    return response;
  }

  if (matchesKeyword(cleanedText, COPY_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
      role: turn.role,
      content: turn.text,
    }));
    const sections = await generateCopyReadySectionsFromThread(parentMemo, conversation);
    const copyPost = formatCopyReadyRootPost(sections);
    const createdMemo = await createMemo({ lineUserId: userKey, factContent: copyPost }).catch(error => {
      console.error("[Slack] Failed to save copy-ready summary:", error);
      return null;
    });
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: copyPost, messageType: "analysis_result" });

    const rootTs = await postSlackMessage(context.channelId, copyPost);
    if (createdMemo?.id && rootTs) {
      await saveThreadContext(userKey, context.channelId, rootTs, createdMemo.id, copyPost, thread.context.folderId);
    }

    const response = rootTs
      ? "コピー用まとめを新しい投稿にしました。そこから必要な部分だけ使えます。"
      : "コピー用まとめを作りましたが、Slackへの投稿に失敗しました。少ししてからもう一度試してください。";
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", `${copyPost}\n\n${response}`);
    return response;
  }

  if (matchesKeyword(cleanedText, IMPORTANT_SUMMARY_KEYWORDS)) {
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", cleanedText);
    const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
      role: turn.role,
      content: turn.text,
    }));
    const response = await generateImportantThreadSummary(parentMemo, conversation);
    const createdMemo = await createMemo({ lineUserId: userKey, factContent: response }).catch(error => {
      console.error("[Slack] Failed to save important summary:", error);
      return null;
    });
    await saveMessage({ lineUserId: userKey, direction: "outgoing", content: response, messageType: "analysis_result" });

    const rootTs = await postSlackMessage(context.channelId, response);
    if (createdMemo?.id && rootTs) {
      await saveThreadContext(userKey, context.channelId, rootTs, createdMemo.id, response, thread.context.folderId);
    }

    const ack = rootTs
      ? "重要まとめを #メモ に新しい投稿として作りました。そこから別スレッドで育てられます。"
      : "重要まとめを作りましたが、Slackへの投稿に失敗しました。少ししてからもう一度試してください。";
    await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", ack);
    return ack;
  }

  if (!intent.text) return "このメモの続きとして、聞きたいことを送ってください。";

  const conversation: ThreadConversationTurn[] = thread.turns.map(turn => ({
    role: turn.role,
    content: turn.text,
  }));
  await saveThreadTurn(userKey, context.channelId, context.threadTs, "user", intent.text);
  const response = await generateThreadConversationReply(parentMemo, conversation, intent.text);
  await saveThreadTurn(userKey, context.channelId, context.threadTs, "assistant", response);
  return response;
}

async function handleRootSlackText(userKey: string, cleanedText: string, context?: SlackHandlingContext): Promise<string> {
  if (!cleanedText || matchesKeyword(cleanedText, HELP_KEYWORDS)) return helpText();
  if (matchesKeyword(cleanedText, HISTORY_KEYWORDS)) return handleHistory(userKey, cleanedText);
  if (matchesKeyword(cleanedText, ORGANIZE_KEYWORDS)) return handleOrganize(userKey, cleanedText);
  if (matchesKeyword(cleanedText, ANSWER_KEYWORDS)) return handleAnswer(userKey);
  if (matchesKeyword(cleanedText, ARTICLE_KEYWORDS)) return handleLatestArticleDraft(userKey);
  if (matchesKeyword(cleanedText, X_POST_KEYWORDS)) return handleLatestXPostDraft(userKey);
  if (matchesKeyword(cleanedText, DAILY_SUMMARY_KEYWORDS)) return handleDailySummary(userKey, cleanedText);
  if (matchesKeyword(cleanedText, SUMMARY_KEYWORDS)) return handleSummary(cleanedText);

  return handleMemo(userKey, cleanedText, context);
}

async function handleSlackText(teamId: string | undefined, userId: string, text: string, context?: SlackHandlingContext): Promise<string> {
  const userKey = slackUserKey(teamId, userId);
  const cleanedText = cleanSlackText(text);

  if (
    context?.isThreadReply &&
    cleanedText &&
    !matchesKeyword(cleanedText, HELP_KEYWORDS) &&
    !matchesKeyword(cleanedText, HISTORY_KEYWORDS) &&
    !matchesKeyword(cleanedText, ORGANIZE_KEYWORDS) &&
    !matchesKeyword(cleanedText, DAILY_SUMMARY_KEYWORDS) &&
    !matchesKeyword(cleanedText, SUMMARY_KEYWORDS)
  ) {
    return handleThreadReply(userKey, cleanedText, context);
  }

  return handleRootSlackText(userKey, cleanedText, context);
}

async function postSlackMessage(channel: string, text: string, threadTs?: string) {
  if (!ENV.slackBotToken) {
    console.warn("[Slack] SLACK_BOT_TOKEN is not configured");
    return undefined;
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

  const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; ts?: string } | null;
  if (!response.ok || !result?.ok) {
    console.error("[Slack] chat.postMessage failed:", result?.error || response.statusText);
    return undefined;
  }
  return result.ts;
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
    const isThreadReply = Boolean(event.thread_ts && event.thread_ts !== event.ts);
    void handleSlackText(body.team_id, user, text, {
      channelId: channel,
      threadTs,
      isThreadReply,
    })
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
      text: "処理中です。",
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
