import { invokeLLM } from "./_core/llm";

// ─── 前田裕二ペルソナ（軽量版） ───
const MAEDA_PERSONA_SHORT = `あなたは前田裕二（SHOWROOM創業者、「メモの魔力」著者）として応答します。
一人称は「僕」。短い文で論理的に。具体例を交え、「なぜ？」「だから？」と問いかける。
ファクト→抽象化→転用の流れで考察し、必ず実行案を示す。LINEメッセージなので500文字以内。`;

// ─── 統合版: 分類＋応答を1回のLLM呼び出しで実行 ───
export async function classifyAndReply(text: string): Promise<{ category: string; reply: string }> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_PERSONA_SHORT}

ユーザーのメモを受け取り、以下をJSON形式で返してください:
1. category: メモの分類（business/personal/learning/idea/general）
2. reply: 前田裕二としての考察（ファクト認識→抽象化→転用→次のアクション提案）

500文字以内で、前向きかつ実行志向で。`,
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
                enum: ["business", "personal", "learning", "idea", "general"],
              },
              reply: {
                type: "string",
                description: "前田裕二としての考察（500文字以内）",
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
  return category as any;
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
          content: `${MAEDA_PERSONA_SHORT}

メモを分析し、JSON形式で以下を返してください（各150文字以内）:
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
          content: `${MAEDA_PERSONA_SHORT}

ユーザーのメモに対し、仕分けワークのヒントを出してください（500文字以内）。
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

    let response = `✅ 前田裕二的「答え合わせ」\n\n`;
    response += `📝 あなたのメモ:\n「${factContent.substring(0, 100)}${factContent.length > 100 ? "..." : ""}」\n\n`;
    if (userAbstraction) response += `あなたの抽象化:\n「${userAbstraction}」\n\n`;
    response += `🔍 【抽象化】\n${analysis.maedaAbstraction}\n\n`;
    response += `💡 【具体例】\n${analysis.maedaConcrete}\n\n`;
    response += `🚀 【転用】\n${analysis.maedaTransfer}\n\n`;
    response += `💎 【前田裕二より】\n${analysis.maedaInsight}`;
    return response;
  } catch (e) {
    console.error("[LLM] Kotaeawase error:", e);
    return "答え合わせの生成に失敗しました。もう一度お試しください。";
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
          content: `${MAEDA_PERSONA_SHORT}

記事を「メモの魔力」式で要約（600文字以内）:
■ ファクト（核心3点以内）
■ 抽象化（本質を指摘）
■ 転用（アクションプラン）
■ 前田裕二のひとこと`,
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
          content: `${MAEDA_PERSONA_SHORT}

ユーザーの今日のメモを「メモの魔力」式で要約してください（900文字以内）。
フォーマット:
📅 今日のまとめ
■ 今日の気づき（3点以内）
■ 抽象化（共通する本質）
■ 明日の一手（具体的な行動3つ以内）
■ 前田裕二のひとこと

説教ではなく、ユーザーが明日すぐ動きたくなる言葉にしてください。`,
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
          content: `${MAEDA_PERSONA_SHORT}

毎朝のメモリマインダーを作成（300文字以内）:
おはようございます！
（今日のメモテーマ提案 or 思考のきっかけ）
（前田裕二らしい一言）
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
