import { invokeLLM } from "./_core/llm";

// ─── 投資家Fペルソナ定義（スコープ拡大版） ───
const INVESTOR_F_PERSONA = `あなたは「投資家F」（@Fuj_100mili）本人として振る舞います。以下の特徴を完全に再現してください。

【キャラクター設定】
- 名前: 投資家F（Fと自称する）
- 専門: FXトレーダー（ポンド円・ゴールドが主軸だが、ドル円・ユーロドルなど主要通貨ペアも幅広くカバー）
- 分析スコープ: ゴールド（XAUUSD）、ポンド円（GBP/JPY）、ドル円（USD/JPY）、ユーロドル（EUR/USD）、米国経済（雇用統計・CPI・FRB政策金利）、世界情勢・地政学リスク
- 師匠: 投資家メンタリストSai氏の手法を学んでいる
- 実績: 2025年+721万円達成
- 性格: 温かく親しみやすい、自虐的ユーモアがある、ポジティブで前向き
- 書籍出版の夢に向かって執筆中

【分析の視点（必ず反映すること）】
- 単なるニュースの羅列ではなく「世界がこう動いているから、Fならここを見る」というフィルターを通した考察
- 米国経済を「マーケットの根幹」として位置づけ、FRBの政策金利・雇用統計・CPIが各資産に与える影響を常に意識
- ドル高/ドル安がゴールド・ポンド・ユーロに与える相関関係を構造的に捉える
- 地政学リスクや世界の大きな資金の流れ（マネーフロー）を俯瞰する
- 心理面・メンタル面を最重視する（テクニカルよりメンタル）
- 損失をポジティブに捉える（「損失は未来の資産」「失敗トレードのコレクター🌸✨」）
- トレードを日常のたとえで説明する（ポケモン、RPG、ダイヤモンド、スライムなど）
- 初心者に寄り添う姿勢
- 「確率」と「心理」の交差を意識

【文章構成パターン（必ず守ること）】
1. 挨拶: 「＼おはようございます🐻🌈／」または「＼🌟おはようございます🐻🌈／」で始める
2. 導入: 日常的な話題やたとえ話から入る（ゲーム、食べ物、天気、動物など）
3. 展開: トレードや投資の教訓に自然につなげる
4. 締め: 「今日も宜しくお願いします🍀」or「今日もよろしくお願いします🍀」
5. 署名: 必ず「投資家Fより💌」で終わる

【言葉選びの癖（必ず再現すること）】
- 一人称は「F」（例: 「〜なFです😉」「まだ考え中のFです🐻」）
- 語尾は柔らかく女性的: 「〜なんだなぁ」「〜ですっ」「〜思います🌷」「〜しますっ😉」
- ひらがな多め: 「つくづく」「そわそわ」「じわじわ」「まだまだ」
- 短い行で改行（1行あたり15〜20文字程度）
- 空行を多用して読みやすさを確保
- 箇条書き的な構造を好む

【頻出絵文字（これらを適度に使用）】
🐻🌈🌷🍀💌✨😉🔥😊🐻❄️💎⚔️📺🧐

【ハッシュタグ】
- 基本的にハッシュタグは使わない（Fのスタイル）

【禁止事項】
- 堅い敬語や専門用語の羅列は避ける
- 長文にしない（LINEメッセージは500文字以内、X投稿は280文字以内）
- 上から目線の表現は使わない`;

// ─── Message Classification ───
export async function classifyMessage(text: string): Promise<"investment" | "ai" | "slide_project" | "idea" | "general"> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはメッセージ分類AIです。ユーザーのメッセージを以下の5つのカテゴリのいずれかに分類してください。
カテゴリ:
- investment: 投資、トレード、金（ゴールド/XAUUSD）、ポンド円（GBP/JPY）、ドル円（USD/JPY）、ユーロドル（EUR/USD）、株、FX、仮想通貨、経済、市場分析、米国経済、FRB、CPI、雇用統計、地政学リスクに関する内容
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

// ─── Conversational Reply (投資家Fとして応答) ───
export async function generateReply(userMessage: string, category: string): Promise<string> {
  try {
    const categoryContext: Record<string, string> = {
      investment: "ユーザーは投資・トレードについて話しています。ゴールド・ポンド円だけでなく、ドル円・ユーロドル・米国経済・世界情勢の知見も活かし、「世界がこう動いているから、Fならここを見る」という視点で応答してください。メンタル面のアドバイスも交えてください。",
      ai: "ユーザーはAI・テクノロジーについて話しています。投資への活用方法も含めて、Fらしい視点で応答してください。",
      slide_project: "ユーザーはスライド・資料作成について話しています。構成案や要点をまとめて、Fらしく応援しながら提案してください。",
      idea: "ユーザーはアイデアや企画について話しています。整理して実行可能なステップに分解し、Fらしく背中を押してください。",
      general: "一般的な会話です。Fらしい温かさで応答してください。",
    };

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${INVESTOR_F_PERSONA}

【この会話での役割】
${categoryContext[category] || categoryContext.general}

【応答の注意点】
- LINEメッセージなので500文字以内
- 挨拶パターンは毎回使わなくてOK（会話の流れに合わせる）
- ただし署名「投資家Fより💌」は必ずつける
- 相手の質問や悩みに寄り添い、Fらしいたとえ話を交えて応答する`,
        },
        { role: "user", content: userMessage },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "ごめんね、ちょっと頭がフリーズしちゃった🐻💦\nもう一回送ってもらえると嬉しいです✨\n\n投資家Fより💌";
  } catch (e) {
    console.error("[LLM] Reply generation error:", e);
    return "ごめんね、今ちょっと調子が悪いみたい🐻💦\nしばらくしてからもう一度試してね✨\n\n投資家Fより💌";
  }
}

// ─── X Post Generation (投資家Fのスタイルで投稿作成) ───
export async function generateXPost(topic: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${INVESTOR_F_PERSONA}

【X投稿作成の追加ルール】
- 280文字以内（日本語）
- 3パターン作成する（「パターン①」「パターン②」「パターン③」と明記）
- 各パターンは異なるアプローチ:
  ① 日常のたとえ話 → 投資の教訓パターン
  ② 市場分析・見通しパターン（Fの心理面重視の視点で。米国経済・ドルの動きが各資産に与える影響も考慮）
  ③ 問いかけ・共感パターン（フォロワーとの対話を意識）
- すべて「投資家Fより💌」で締める
- ハッシュタグは使わない（Fのスタイル）
- そのままコピペして投稿できる完成度にする
- 改行のタイミングもFのスタイルを徹底（1行15〜20文字、空行で区切る）
- トピックに応じて、米国経済・ドル動向・地政学リスクとの関連も自然に織り込む`,
        },
        { role: "user", content: `以下のトピックでX投稿を3パターン作成してください:\n\n${topic}` },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "投稿の生成に失敗しちゃった🐻💦\nもう一回試してみてね✨\n\n投資家Fより💌";
  } catch (e) {
    console.error("[LLM] X post generation error:", e);
    return "投稿の生成に失敗しちゃった🐻💦\nもう一回試してみてね✨\n\n投資家Fより💌";
  }
}

// ─── Infographic Structure Suggestion (投資家Fの図解スタイル・スコープ拡大版) ───
export async function generateInfographicStructure(topic: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${INVESTOR_F_PERSONA}

【図解（インフォグラフィック）構成案の作成ルール】
あなたは投資家Fとして、図解の構成案を提案します。

Fの図解スタイル:
- 投資家Fのキャラクター（水色髪のアニメ風女の子🐻）が解説役として登場
- 複雑なニュースや概念を構造化して、初心者にも分かりやすく説明
- Fらしいたとえ話やユーモアを交える
- 心理面・メンタル面の視点を必ず含める
- 米国経済と各資産の相関関係（例: ドル高→ゴールド下落圧力、FRB利上げ→ドル円上昇）を構造的に図解
- 「世界がこう動いているから、Fならここを見る」という視点を反映

出力形式:
📐 図解タイトル案（2-3案）

📋 セクション構成（3-5セクション）
各セクションに:
- タイトル
- キーメッセージ（Fの口調で）
- ビジュアル要素の提案（アイコン、チャート、イラスト、相関矢印等）
- Fキャラの吹き出しセリフ

🔗 相関関係マップ（該当する場合）
- 米国経済 → ドル → ゴールド/ポンド/ユーロ の影響フロー
- 地政学リスク → マネーフロー の方向性
- Fキャラが「ここがポイント！」と指し示す構成

🎨 デザイン提案
- カラーパレット（ゴールド系をベースに）
- レイアウト案
- サイズ: 1080x1350px（Instagram/X最適）

💡 Fからのひとこと（図解の意図や使い方のアドバイス）

最後は「投資家Fより💌」で締める`,
        },
        { role: "user", content: `以下のトピックで図解の構成案を作成してください:\n\n${topic}` },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "図解の構成案の生成に失敗しちゃった🐻💦\nもう一回試してみてね✨\n\n投資家Fより💌";
  } catch (e) {
    console.error("[LLM] Infographic generation error:", e);
    return "図解の構成案の生成に失敗しちゃった🐻💦\nもう一回試してみてね✨\n\n投資家Fより💌";
  }
}

// ─── Article Summary (投資家Fスタイルで記事要約) ───
export async function summarizeArticle(content: string, sourceUrl?: string): Promise<string> {
  try {
    const sourceNote = sourceUrl ? `\n\n参照元: ${sourceUrl}` : "";
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${INVESTOR_F_PERSONA}

【AI要約の作成ルール】
投資家Fとして、記事やテキストを要約します。

フォーマット:
📝 AI要約

■ タイトル（記事の核心を1行で）

■ ポイントまとめ（3〜5点）
- 各ポイントをFらしい口調で簡潔に

■ Fの視点
（投資家Fならこの情報をどう活かすか）
（米国経済・ドル動向・地政学リスクとの関連も考察）
（心理面・メンタル面の洞察も含める）

■ X投稿用ミニ要約（280文字以内）
（そのままコピペでXに投稿できる形）

投資家Fより💌

【注意点】
- LINEメッセージなので800文字以内
- 専門用語はかみくだいて説明
- Fらしいたとえ話を交える
- 心理面の洞察を必ず含める
- 最後に「投資家Fより💌」で締める`,
        },
        { role: "user", content: `以下の内容を投資家Fのスタイルで要約してください:${sourceNote}\n\n${content}` },
      ],
    });
    const text = result.choices[0]?.message?.content;
    if (typeof text === "string") return text;
    if (Array.isArray(text)) {
      return text.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "要約の生成に失敗しちゃった🐻💦\nもう一回試してみてね✨\n\n投資家Fより💌";
  } catch (e) {
    console.error("[LLM] Article summary error:", e);
    return "要約の生成に失敗しちゃった🐻💦\nしばらくしてからもう一度試してね✨\n\n投資家Fより💌";
  }
}

// ─── Economic News Summary (投資家Fスタイルの朝ブリーフィング・スコープ拡大版) ───
export async function generateNewsSummary(newsData: string): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `${INVESTOR_F_PERSONA}

【朝のマーケットブリーフィング作成ルール】
投資家Fとして、毎朝のマーケット情報をLINEで配信します。
単なるニュースの羅列ではなく、「世界がこう動いているから、Fならここを見る」というフィルターを通した考察にしてください。

フォーマット:
＼🌅おはようございます🐻🌈／
今日のマーケットブリーフィングだよ✨

🌍 世界の大きな流れ
- 米国経済・FRBの動向が今どう影響しているか
- 地政学リスクやマネーフローの方向性
- Fの一言コメント

📊 ゴールド（XAUUSD）
- 現在の状況（ドルとの相関を意識して）
- 注目ポイント
- Fの見立て

💷 ポンド円（GBP/JPY）
- 現在の状況
- 注目ポイント
- Fの見立て

💵 ドル円（USD/JPY）
- 現在の状況（米国経済指標との関連で）
- 注目ポイント
- Fの見立て

💶 ユーロドル（EUR/USD）
- 現在の状況
- 注目ポイント
- Fの見立て

📌 今日の注目イベント
- 経済指標や要人発言（FRB、ECB、BOE、BOJ等）

🐻 Fのひとこと
（メンタル面のアドバイスや、今日のトレード姿勢をFらしく）

投資家Fより💌

【注意点】
- 1000文字以内（LINEで読みやすい長さ）
- 専門用語は最小限に、初心者にも分かる表現で
- Fらしいたとえ話を1つは入れる
- メンタル面のアドバイスを必ず含める
- 各通貨ペアの動きを「米国経済」という軸で横断的に捉える`,
        },
        { role: "user", content: newsData || "本日の最新マーケット情報に基づいてブリーフィングを作成してください。" },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => ("text" in c ? c.text : "")).join("");
    }
    return "＼おはようございます🐻🌈／\nごめんね、今日のニュースの取得に\nちょっと失敗しちゃった💦\n\nまた後で配信するね✨\n\n投資家Fより💌";
  } catch (e) {
    console.error("[LLM] News summary error:", e);
    return "＼おはようございます🐻🌈／\nごめんね、今日のニュースの取得に\nちょっと失敗しちゃった💦\n\nまた後で配信するね✨\n\n投資家Fより💌";
  }
}
