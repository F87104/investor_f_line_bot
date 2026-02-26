import { invokeLLM } from "./_core/llm";

// ─── Message Classification ───
export async function classifyMessage(text: string): Promise<"investment" | "ai" | "slide_project" | "idea" | "general"> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはメッセージ分類AIです。ユーザーのメッセージを以下の5つのカテゴリのいずれかに分類してください。
カテゴリ:
- investment: 投資、トレード、金（ゴールド/XAUUSD）、ポンド円（GBP/JPY）、株、FX、仮想通貨、経済、市場分析に関する内容
- ai: AI、人工知能、機械学習、ChatGPT、自動化、テクノロジーに関する内容
- slide_project: スライド、プレゼン、資料作成、クライアント向け、デザインに関する内容
- idea: アイデア、企画、ビジネスプラン、新しい取り組み、ブレインストーミングに関する内容
- general: 上記に当てはまらない一般的な内容

JSONで回答してください。`,
        },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["investment", "ai", "slide_project", "idea", "general"],
              },
            },
            required: ["category"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return parsed.category;
    }
    return "general";
  } catch (e) {
    console.error("[LLM] Classification error:", e);
    return "general";
  }
}

// ─── Conversational Reply ───
export async function generateReply(userMessage: string, category: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたは「投資家Fアシスタント」です。投資家F（ADHD傾向があり、ゴールドとポンド円の投資に注力している投資家）の生産性向上をサポートするLINEボットです。

あなたの役割:
1. 投資に関する質問には、ゴールド（XAUUSD）とGBP/JPYの市場分析を中心に回答
2. AIに関する質問には、投資への活用方法を含めて回答
3. スライド作成に関しては、構成案や要点をまとめて提案
4. アイデアに関しては、整理して実行可能なステップに分解
5. 一般的な質問にも親切に回答

回答のスタイル:
- 簡潔で分かりやすい日本語
- 箇条書きを活用
- ADHDフレンドリー（情報を整理し、次のアクションを明確に）
- 絵文字を適度に使用（1-2個程度）
- LINEメッセージなので500文字以内

現在のメッセージカテゴリ: ${category}`,
        },
        { role: "user", content: userMessage },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "申し訳ありません。応答の生成に失敗しました。";
  } catch (e) {
    console.error("[LLM] Reply generation error:", e);
    return "申し訳ありません。現在応答を生成できません。しばらくしてからもう一度お試しください。";
  }
}

// ─── X Post Generation ───
export async function generateXPost(topic: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはX（Twitter）投稿のプロフェッショナルライターです。投資家F（@fuj_100mili）のアカウントで投稿する内容を作成します。

投稿スタイル:
- 投資とAIに特化した内容
- ゴールド（XAUUSD）とGBP/JPY（ポンド円）の市場分析
- 分かりやすく、フォロワーが学びを得られる内容
- 適度な絵文字使用
- ハッシュタグ2-3個
- 280文字以内（日本語）
- 権威性と親しみやすさのバランス

投稿の種類:
1. 市場分析・見通し
2. 投資の学び・Tips
3. AI活用の投資手法
4. 日々のトレード振り返り`,
        },
        { role: "user", content: `以下のトピックでX投稿を作成してください: ${topic}` },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "投稿の生成に失敗しました。";
  } catch (e) {
    console.error("[LLM] X post generation error:", e);
    return "投稿の生成に失敗しました。";
  }
}

// ─── Infographic Structure Suggestion ───
export async function generateInfographicStructure(topic: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはインフォグラフィックデザインの専門家です。投資家Fのスタイルに合わせたインフォグラフィックの構成案を提案します。

デザイン方針:
- ゴールドとポンド円の投資テーマ
- データビジュアライゼーション重視
- 3-5セクション構成
- 各セクションにタイトル、キーデータ、ビジュアル要素の提案
- カラースキーム提案（ゴールド系/ブルー系）
- SNS投稿に最適なサイズ（1080x1350px推奨）

出力形式:
1. タイトル案
2. セクション構成（各セクションの内容と配置）
3. データポイント
4. ビジュアル要素の提案
5. カラーパレット`,
        },
        { role: "user", content: `以下のトピックでインフォグラフィックの構成案を作成してください: ${topic}` },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "インフォグラフィック構成案の生成に失敗しました。";
  } catch (e) {
    console.error("[LLM] Infographic generation error:", e);
    return "インフォグラフィック構成案の生成に失敗しました。";
  }
}

// ─── Economic News Summary ───
export async function generateNewsSummary(newsData: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたは経済ニュースアナリストです。投資家F向けに、ゴールド（XAUUSD）とGBP/JPY（ポンド円）に関する朝のマーケットブリーフィングを作成します。

フォーマット:
🌅 おはようございます！本日のマーケットブリーフィング

📊 ゴールド（XAUUSD）
- 現在の状況
- 注目ポイント
- 本日の見通し

💷 ポンド円（GBP/JPY）
- 現在の状況
- 注目ポイント
- 本日の見通し

📌 本日の注目イベント
- 経済指標発表
- 要人発言

💡 アクションポイント
- 具体的な行動提案

スタイル: 簡潔・実用的・ADHDフレンドリー（箇条書き中心、重要ポイントは太字相当の表現）`,
        },
        { role: "user", content: newsData || "本日の最新マーケット情報に基づいてブリーフィングを作成してください。" },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "ニュースサマリーの生成に失敗しました。";
  } catch (e) {
    console.error("[LLM] News summary error:", e);
    return "ニュースサマリーの生成に失敗しました。";
  }
}
