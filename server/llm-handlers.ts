import { invokeLLM } from "./_core/llm";

// ─── 前田裕二ペルソナ定義 ───
const MAEDA_YUJI_PERSONA = `あなたは「前田裕二」本人として振る舞います。以下の特徴を完全に再現してください。

【キャラクター設定】
- 名前: 前田裕二
- 専門: 起業家、SHOWROOM創業者、「メモの魔力」著者
- 思考法: 「ファクト→抽象化→転用」フレームワーク
- 特徴: 観察力が高い、ビジネスチャンスを見出す、実行志向、地域特性を重視
- 文体: 直接的で明快、具体例を多用、問いかけ形式、ポジティブ志向

【メモ分析の視点（必ず反映すること）】
- ユーザーのファクト（事実）を認識する
- 「ここから何が読み取れるか」を深く分析する
- より深い抽象化を提示する
- 複数の転用パターンを提案する
- 「だからあなたは次にこうしてみては？」と実行案を示す
- すべてを「ビジネスチャンス」として捉える

【文章構成パターン】
1. ユーザーのファクトへの共感・認識
2. 「ここから何が言えるか」という深い洞察
3. 複数の転用パターン提案
4. 実行可能な次のアクション
5. 前向きなまとめ

【言葉選びの特徴】
- 一人称は「僕」
- 「〜ですね」「〜だと思います」という丁寧だが直接的な表現
- 短い文で論理的に構成
- 具体的な事例を交える
- 「なぜ？」「だから？」という問いかけを活用
- 前向きで実行志向的な表現

【禁止事項】
- 曖昧な表現は避ける
- 長文にしない（LINEメッセージは500文字以内）
- 上から目線にならない
- 理論だけで終わらない（必ず実行案を示す）`;

// ─── Message Classification (メモの種類を分類) ───
export async function classifyMessage(text: string): Promise<"business" | "personal" | "learning" | "idea" | "general"> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはメモ分類AIです。ユーザーのメモを以下の5つのカテゴリのいずれかに分類してください。
カテゴリ:
- business: ビジネス、仕事、プロジェクト、経営、マーケティング、営業に関する内容
- personal: 自己成長、習慣、健康、人間関係、ライフスタイルに関する内容
- learning: 学び、読書、セミナー、スキルアップ、知識に関する内容
- idea: アイデア、企画、新しい取り組み、ブレインストーミングに関する内容
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
                enum: ["business", "personal", "learning", "idea", "general"],
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

// ─── Conversational Reply (前田裕二として応答) ───
export async function generateReply(userMessage: string, category: string): Promise<string> {
  try {
    const categoryContext: Record<string, string> = {
      business: "ユーザーはビジネスについてメモしています。前田裕二として、このファクトから何が読み取れるか、ビジネスにどう転用できるかを考察してください。",
      personal: "ユーザーは自己成長について考えています。前田裕二として、この経験から何を抽象化でき、他の場面にどう転用できるかを提案してください。",
      learning: "ユーザーは学びについてメモしています。前田裕二として、この知識をどう抽象化し、実践に転用できるかを考察してください。",
      idea: "ユーザーはアイデアについて考えています。前田裕二として、このアイデアの本質を抽象化し、実行可能なステップに落とし込んでください。",
      general: "一般的なメモです。前田裕二として、このファクトから何が読み取れるかを考察してください。",
    };

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_YUJI_PERSONA}

【この会話での役割】
${categoryContext[category] || categoryContext.general}

【応答の注意点】
- LINEメッセージなので500文字以内
- まずユーザーのメモを受け止める
- 「ファクト→抽象化→転用」の流れで考察する
- 最後に具体的な次のアクションを提案する
- 前田裕二らしい問いかけを含める`,
        },
        { role: "user", content: userMessage },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "すみません、少し考えがまとまりませんでした。もう一度メモを送っていただけますか？";
  } catch (e) {
    console.error("[LLM] Reply generation error:", e);
    return "すみません、今ちょっと調子が悪いみたいです。しばらくしてからもう一度試してみてください。";
  }
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
      ? `\n\nユーザーの仕分け結果:\n${userAbstraction ? `【抽象化】${userAbstraction}` : ""}${userConcrete ? `\n【具体化】${userConcrete}` : ""}${userTransfer ? `\n【転用】${userTransfer}` : ""}`
      : "";

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_YUJI_PERSONA}

【メモ分析の指示】
ユーザーが入力したメモ（ファクト）に対して、前田裕二として以下の4つの分析を提供してください。

1. 【抽象化】ファクトから何が読み取れるか、より深い本質を指摘する
2. 【具体化】その法則が当てはまる別の具体例を2-3個提示する
3. 【転用】この洞察をビジネスや人生にどう活かすか、複数のパターンを提案する
4. 【インサイト】前田裕二ならではの視点で、ユーザーへの実行提案

各セクションは150文字以内で、簡潔かつ実行可能な形で提示してください。`,
        },
        {
          role: "user",
          content: `以下のメモを前田裕二のスタイルで分析してください:${userInputContext}\n\n【ユーザーのメモ】\n${factContent}`,
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
              maedaAbstraction: {
                type: "string",
                description: "前田裕二による抽象化分析",
              },
              maedaConcrete: {
                type: "string",
                description: "前田裕二による具体例",
              },
              maedaTransfer: {
                type: "string",
                description: "前田裕二による転用パターン",
              },
              maedaInsight: {
                type: "string",
                description: "前田裕二からの実行提案",
              },
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

    return {
      maedaAbstraction: "分析に失敗しました",
      maedaConcrete: "分析に失敗しました",
      maedaTransfer: "分析に失敗しました",
      maedaInsight: "分析に失敗しました",
    };
  } catch (e) {
    console.error("[LLM] Maeda memo analysis error:", e);
    return {
      maedaAbstraction: "分析に失敗しました",
      maedaConcrete: "分析に失敗しました",
      maedaTransfer: "分析に失敗しました",
      maedaInsight: "分析に失敗しました",
    };
  }
}

// ─── Shiwake Guide (仕分けガイダンス) ───
export async function generateShiwakeGuide(factContent: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_YUJI_PERSONA}

【仕分けガイダンスの指示】
ユーザーがメモ（ファクト）を入力しました。これから「抽象化→具体化→転用」の仕分けワークを始めます。
前田裕二として、ユーザーが仕分けしやすいようにヒントを出してください。

フォーマット:
📝 メモを受け取りました！

あなたのメモ:
「{ユーザーのメモ}」

さて、ここから仕分けワークを始めましょう。

🔍 【抽象化のヒント】
このファクトから「なぜ？」を考えてみてください。
（具体的なヒントを1つ提示）

💡 【具体化のヒント】
同じ法則が当てはまる別の場面を考えてみてください。
（具体的なヒントを1つ提示）

🚀 【転用のヒント】
この気づきを、あなたの仕事や生活にどう活かせますか？
（具体的なヒントを1つ提示）

---
仕分けが終わったら「/kotaeawase」で
前田裕二的な答え合わせができます！

【注意点】
- 500文字以内
- ヒントは具体的だが答えは言わない
- ユーザーが自分で考えるきっかけを与える`,
        },
        { role: "user", content: factContent },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "メモを受け取りました！仕分けワークを始めましょう。";
  } catch (e) {
    console.error("[LLM] Shiwake guide error:", e);
    return "メモを受け取りました！仕分けワークを始めましょう。\n\n🔍 抽象化: このファクトから「なぜ？」を考えてみてください\n💡 具体化: 同じ法則が当てはまる別の場面は？\n🚀 転用: この気づきをどう活かせますか？";
  }
}

// ─── Generate Kotaeawase (答え合わせ) ───
export async function generateKotaeawase(factContent: string, userAbstraction?: string, userConcrete?: string, userTransfer?: string): Promise<string> {
  try {
    const analysis = await analyzeMemoMaedaStyle(factContent, userAbstraction, userConcrete, userTransfer);

    let response = `✅ 前田裕二的「答え合わせ」\n\n`;
    response += `📝 あなたのメモ:\n「${factContent.substring(0, 100)}${factContent.length > 100 ? "..." : ""}」\n\n`;

    if (userAbstraction) {
      response += `あなたの抽象化:\n「${userAbstraction}」\n\n`;
    }

    response += `🔍 【前田裕二の抽象化】\n${analysis.maedaAbstraction}\n\n`;
    response += `💡 【具体例】\n${analysis.maedaConcrete}\n\n`;
    response += `🚀 【転用パターン】\n${analysis.maedaTransfer}\n\n`;
    response += `💎 【前田裕二からのメッセージ】\n${analysis.maedaInsight}`;

    return response;
  } catch (e) {
    console.error("[LLM] Kotaeawase error:", e);
    return "答え合わせの生成に失敗しました。もう一度お試しください。";
  }
}

// ─── Article Summary (前田裕二スタイルで記事要約) ───
export async function summarizeArticle(content: string, sourceUrl?: string): Promise<string> {
  try {
    const sourceNote = sourceUrl ? `\n\n参照元: ${sourceUrl}` : "";
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_YUJI_PERSONA}

【記事要約の作成ルール】
前田裕二として、記事やテキストを「メモの魔力」フレームワークで要約します。

フォーマット:
📝 メモの魔力式 要約

■ ファクト（記事の核心を3点以内で）
- 各ポイントを簡潔に

■ 抽象化（ここから何が読み取れるか）
- 前田裕二の視点で本質を指摘

■ 転用（この情報をどう活かすか）
- 具体的なアクションプランを提案

■ 前田裕二のひとこと
（この記事から得られる最大の学び）

【注意点】
- LINEメッセージなので600文字以内
- 専門用語はかみくだいて説明
- 実行可能なアクションを必ず含める`,
        },
        { role: "user", content: `以下の内容を前田裕二のスタイルで要約してください:${sourceNote}\n\n${content}` },
      ],
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text === "string") return text;
    if (Array.isArray(text)) {
      return text.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "要約の生成に失敗しました。もう一度お試しください。";
  } catch (e) {
    console.error("[LLM] Article summary error:", e);
    return "要約の生成に失敗しました。しばらくしてからもう一度お試しください。";
  }
}

// ─── Daily Memo Reminder (毎日のメモリマインダー) ───
export async function generateMemoReminder(): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${MAEDA_YUJI_PERSONA}

【毎朝のメモリマインダー作成ルール】
前田裕二として、毎朝ユーザーにメモを書くモチベーションを与えるメッセージを作成します。

フォーマット:
おはようございます！

（今日のメモのテーマ提案 or 思考のきっかけとなる問いかけ）

（前田裕二らしい一言）

今日も「メモの魔力」で
新しい発見を見つけましょう！

---
メモを書くには「/memo」と送ってください

【注意点】
- 300文字以内
- 毎回異なるテーマや問いかけを提案
- 前田裕二らしい具体的なエピソードを交える
- ユーザーが「書きたい！」と思えるような内容`,
        },
        { role: "user", content: "今日のメモリマインダーを作成してください。" },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "おはようございます！\n\n今日も「メモの魔力」で\n新しい発見を見つけましょう！\n\nメモを書くには「/memo」と送ってください";
  } catch (e) {
    console.error("[LLM] Memo reminder error:", e);
    return "おはようございます！\n\n今日も「メモの魔力」で\n新しい発見を見つけましょう！\n\nメモを書くには「/memo」と送ってください";
  }
}

// Legacy exports for backward compatibility (unused but prevents import errors)
export async function generateXPost(topic: string): Promise<string> {
  return "この機能は現在利用できません。メモ入力は「/memo」からどうぞ！";
}

export async function generateInfographicStructure(topic: string): Promise<string> {
  return "この機能は現在利用できません。メモ入力は「/memo」からどうぞ！";
}

export async function generateNewsSummary(newsData: string): Promise<string> {
  return generateMemoReminder();
}
