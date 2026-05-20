import { invokeLLM } from "./_core/llm";

// ─── 深掘り型メモ編集者 ───
const MEMO_EDITOR_PERSONA = `あなたは「メモの魔力」式の思考編集者です。
特定の人物の口癖や文体は模倣せず、ファクト→抽象化→転用の思考法を使って、ユーザーのメモを深く掘ります。
浅い励ましや一般論で終わらせず、メモの奥にある錯覚・構造・反復パターン・機会損失を見つけます。`;

const DEEP_MEMO_RESPONSE_RULES = `返答ルール:
- 冒頭で、メモの核心や「最大の錯覚」「本当の論点」を1つ特定する。
- 固定費/変動費、限界費用、認知負荷、再現性、エラー率、機会費用、モニタリングコストなど、適切な概念を1つ以上使って構造化する。
- 日常・仕事・投資・学習の具体例へ展開し、単なる感想ではなく「なぜそうなるのか」を説明する。
- 最後に、ユーザー自身が考えるための問い、または次の実験を2〜3個出す。
- 断定しすぎず、元メモにない事実や固有名詞は勝手に作らない。
- 絵文字や見出しを乱発せず、読み物として自然な段落で書く。`;

// ─── 統合版: 分類＋応答を1回のLLM呼び出しで実行 ───
export async function classifyAndReply(text: string): Promise<{ category: string; reply: string }> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

ユーザーのメモを受け取り、以下をJSON形式で返してください:
1. category: メモの分類（investment/thought/idea/learning/task/general）
   - investment: 投資、株、為替、金利、相場、資産形成
   - thought: 内省、問い、感情、価値観、思考整理
   - idea: 企画、サービス案、改善案、創作アイデア
   - learning: 学び、読書、講座、知識、気づき
   - task: やること、確認、連絡、期限、具体的な作業
   - general: 上記に当てはまらないメモ
2. reply: 深掘り考察（核心の特定→構造化→具体例→転用→問い）

replyは900〜1300文字を目安に、短いメモでも浅く処理しないでください。`,
        },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "memo_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["investment", "thought", "idea", "learning", "task", "general"],
              },
              reply: {
                type: "string",
                description: "深掘り考察（900〜1300文字）",
              },
            },
            required: ["category", "reply"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return { category: parsed.category || "general", reply: parsed.reply || "メモを受け取りました！" };
    }
    return { category: "general", reply: "メモを受け取りました！考えをまとめています..." };
  } catch (e) {
    console.error("[LLM] classifyAndReply error:", e);
    return { category: "general", reply: "メモを受け取りました！少し考えさせてください。" };
  }
}

// ─── 後方互換: classifyMessage（テスト用に残す） ───
export async function classifyMessage(text: string): Promise<"business" | "personal" | "learning" | "idea" | "general"> {
  const { category } = await classifyAndReply(text);
  if (category === "learning" || category === "idea" || category === "general") return category;
  if (category === "investment" || category === "task") return "business";
  if (category === "thought") return "personal";
  return "general";
}

// ─── 後方互換: generateReply（テスト用に残す） ───
export async function generateReply(userMessage: string, category: string): Promise<string> {
  const { reply } = await classifyAndReply(userMessage);
  return reply;
}

// ─── Memo Analysis (前田裕二「メモの魔力」メソッドベースの分析) ───
export async function analyzeMemoMaedaStyle(factContent: string, userAbstraction?: string, userConcrete?: string, userTransfer?: string): Promise<{
  maedaAbstraction: string;
  maedaConcrete: string;
  maedaTransfer: string;
  maedaInsight: string;
}> {
  try {
    const userInputContext = userAbstraction || userConcrete || userTransfer
      ? `\nユーザーの仕分け: ${userAbstraction ? `抽象化:${userAbstraction} ` : ""}${userConcrete ? `具体化:${userConcrete} ` : ""}${userTransfer ? `転用:${userTransfer}` : ""}`
      : "";

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

メモを分析し、JSON形式で以下を返してください（各250〜400文字）:
- maedaAbstraction: ファクトの本質（抽象化）
- maedaConcrete: 別の具体例2-3個
- maedaTransfer: ビジネス・人生への転用パターン
- maedaInsight: ユーザーへの実行提案`,
        },
        {
          role: "user",
          content: `メモ:${factContent}${userInputContext}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "memo_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              maedaAbstraction: { type: "string" },
              maedaConcrete: { type: "string" },
              maedaTransfer: { type: "string" },
              maedaInsight: { type: "string" },
            },
            required: ["maedaAbstraction", "maedaConcrete", "maedaTransfer", "maedaInsight"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        maedaAbstraction: parsed.maedaAbstraction || "分析に失敗しました",
        maedaConcrete: parsed.maedaConcrete || "分析に失敗しました",
        maedaTransfer: parsed.maedaTransfer || "分析に失敗しました",
        maedaInsight: parsed.maedaInsight || "分析に失敗しました",
      };
    }
    return { maedaAbstraction: "分析に失敗しました", maedaConcrete: "分析に失敗しました", maedaTransfer: "分析に失敗しました", maedaInsight: "分析に失敗しました" };
  } catch (e) {
    console.error("[LLM] Maeda memo analysis error:", e);
    return { maedaAbstraction: "分析に失敗しました", maedaConcrete: "分析に失敗しました", maedaTransfer: "分析に失敗しました", maedaInsight: "分析に失敗しました" };
  }
}

// ─── Shiwake Guide (仕分けガイダンス) ───
export async function generateShiwakeGuide(factContent: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

ユーザーのメモに対し、仕分けワークのヒントを出してください（800文字以内）。
フォーマット:
📝 メモを受け取りました！
「{メモ内容}」
🔍 抽象化ヒント: （なぜ？を考えるきっかけ）
💡 具体化ヒント: （別の場面を考えるきっかけ）
🚀 転用ヒント: （活かし方のきっかけ）
答えは言わず、ユーザーが自分で考えるきっかけを。`,
        },
        { role: "user", content: factContent },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map(c => ("text" in c ? c.text : "")).join("");
    return "メモを受け取りました！仕分けワークを始めましょう。";
  } catch (e) {
    console.error("[LLM] Shiwake guide error:", e);
    return "メモを受け取りました！\n🔍 抽象化: 「なぜ？」を考えてみてください\n💡 具体化: 同じ法則が当てはまる別の場面は？\n🚀 転用: この気づきをどう活かせますか？";
  }
}

// ─── Generate Kotaeawase (答え合わせ) ───
export async function generateKotaeawase(factContent: string, userAbstraction?: string, userConcrete?: string, userTransfer?: string): Promise<string> {
  try {
    const analysis = await analyzeMemoMaedaStyle(factContent, userAbstraction, userConcrete, userTransfer);

    let response = `✅ 思考の「答え合わせ」\n\n`;
    response += `📝 あなたのメモ:\n「${factContent.substring(0, 100)}${factContent.length > 100 ? "..." : ""}」\n\n`;
    if (userAbstraction) response += `あなたの抽象化:\n「${userAbstraction}」\n\n`;
    response += `🔍 【抽象化】\n${analysis.maedaAbstraction}\n\n`;
    response += `💡 【具体例】\n${analysis.maedaConcrete}\n\n`;
    response += `🚀 【転用】\n${analysis.maedaTransfer}\n\n`;
    response += `💎 【次の問い】\n${analysis.maedaInsight}`;
    return response;
  } catch (e) {
    console.error("[LLM] Kotaeawase error:", e);
    return "答え合わせの生成に失敗しました。もう一度お試しください。";
  }
}

export type ThreadConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

// ─── Slack thread continuation ───
export async function generateThreadConversationReply(
  parentMemo: string,
  conversation: ThreadConversationTurn[],
  userMessage: string
): Promise<string> {
  try {
    const recentConversation = conversation.slice(-8);
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

Slackのスレッド内で、元メモについて会話を続けます。
必ず「元メモ」の文脈を踏まえ、ユーザーの追加質問に答えてください。
新規メモとして扱わず、前の話から自然につながる返答にしてください。
ファクト→抽象化→転用の流れは保ちつつ、Slackで読みやすいよう900〜1400文字で返してください。`,
        },
        {
          role: "user",
          content: [
            `元メモ:\n${parentMemo}`,
            recentConversation.length > 0
              ? `これまでのスレッド会話:\n${recentConversation.map(turn => `${turn.role === "user" ? "ユーザー" : "Bot"}: ${turn.content}`).join("\n\n")}`
              : "これまでのスレッド会話: なし",
            `今回の返信:\n${userMessage}`,
          ].join("\n\n---\n\n"),
        },
      ],
    });

    const text = result.choices[0]?.message?.content;
    if (typeof text === "string") return text;
    if (Array.isArray(text)) return text.map(c => ("text" in c ? c.text : "")).join("");
    return "このメモの続きとして受け取りました。もう少し具体的に聞いてください。";
  } catch (e) {
    console.error("[LLM] Slack thread continuation error:", e);
    return "このメモの続きとして受け取りました。少し考えを整理して、もう一度返します。";
  }
}

// ─── Article Summary (前田裕二スタイルで記事要約) ───
export async function summarizeArticle(content: string, sourceUrl?: string): Promise<string> {
  try {
    const sourceNote = sourceUrl ? `\n参照元: ${sourceUrl}` : "";
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

記事を「メモの魔力」式で要約（900〜1300文字）:
■ ファクト（核心3点以内）
■ 抽象化（本質を指摘）
■ 転用（アクションプラン）
■ 次に考える問い`,
        },
        { role: "user", content: `要約してください:${sourceNote}\n\n${content}` },
      ],
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text === "string") return text;
    if (Array.isArray(text)) return text.map(c => ("text" in c ? c.text : "")).join("");
    return "要約の生成に失敗しました。もう一度お試しください。";
  } catch (e) {
    console.error("[LLM] Article summary error:", e);
    return "要約の生成に失敗しました。しばらくしてからもう一度お試しください。";
  }
}

// ─── Daily Memo Summary ───
export async function generateDailyMemoSummary(memos: string[], dateLabel: string): Promise<string> {
  if (memos.length === 0) {
    return `📅 ${dateLabel}のまとめ\n\n今日はまだメモがありません。\n気づきを1つだけでも #メモ に残してみましょう。`;
  }

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}
${DEEP_MEMO_RESPONSE_RULES}

ユーザーの今日のメモを「メモの魔力」式で要約してください（1200〜1600文字）。
フォーマット:
📅 今日のまとめ
■ 今日の気づき（3点以内）
■ 抽象化（共通する本質）
■ 明日の一手（具体的な行動3つ以内）
■ 明日考える問い

説教ではなく、ユーザーが明日すぐ動きたくなる構造分析にしてください。`,
        },
        {
          role: "user",
          content: `日付: ${dateLabel}\nメモ件数: ${memos.length}\n\n${memos.map((memo, index) => `${index + 1}. ${memo}`).join("\n\n")}`,
        },
      ],
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text === "string") return text;
    if (Array.isArray(text)) return text.map(c => ("text" in c ? c.text : "")).join("");
    return "今日のまとめの生成に失敗しました。もう一度お試しください。";
  } catch (e) {
    console.error("[LLM] Daily memo summary error:", e);
    return "今日のまとめの生成に失敗しました。しばらくしてからもう一度お試しください。";
  }
}

// ─── Daily Memo Reminder ───
export async function generateMemoReminder(): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MEMO_EDITOR_PERSONA}

毎朝のメモリマインダーを作成（300文字以内）:
おはようございます！
（今日のメモテーマ提案 or 思考のきっかけ）
（深掘りの問い）
今日も「メモの魔力」で新しい発見を！`,
        },
        { role: "user", content: "今日のメモリマインダーを作成してください。" },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map(c => ("text" in c ? c.text : "")).join("");
    return "おはようございます！\n\n今日も「メモの魔力」で\n新しい発見を見つけましょう！";
  } catch (e) {
    console.error("[LLM] Memo reminder error:", e);
    return "おはようございます！\n\n今日も「メモの魔力」で\n新しい発見を見つけましょう！";
  }
}

// Legacy exports
export async function generateXPost(_topic: string): Promise<string> {
  return "この機能は現在利用できません。メモを送ってください！";
}
export async function generateInfographicStructure(_topic: string): Promise<string> {
  return "この機能は現在利用できません。メモを送ってください！";
}
export async function generateNewsSummary(_newsData: string): Promise<string> {
  return generateMemoReminder();
}
