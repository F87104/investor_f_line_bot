import {
  createRichMenu, uploadRichMenuImage, setDefaultRichMenu,
  deleteRichMenu, getRichMenuList, type RichMenuObject,
} from "./line";

// ─── Generate Rich Menu Image using Canvas-like approach ───
// LINE Rich Menu requires 2500x843 or 2500x1686 image
// We'll generate a simple but professional image using SVG → PNG conversion

function generateRichMenuSVG(): string {
  // 2500x843 layout: 3 columns × 2 rows = 6 buttons
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#c9a84c"/>
      <stop offset="100%" style="stop-color:#e8d48b"/>
    </linearGradient>
  </defs>
  <rect width="2500" height="843" fill="url(#bg)"/>
  
  <!-- Grid lines -->
  <line x1="833" y1="0" x2="833" y2="843" stroke="#2a2a4a" stroke-width="2"/>
  <line x1="1667" y1="0" x2="1667" y2="843" stroke="#2a2a4a" stroke-width="2"/>
  <line x1="0" y1="421" x2="2500" y2="421" stroke="#2a2a4a" stroke-width="2"/>
  
  <!-- Row 1 -->
  <!-- X投稿 -->
  <text x="416" y="170" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">✍️</text>
  <text x="416" y="260" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">X投稿</text>
  <text x="416" y="320" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">投稿案を生成</text>
  
  <!-- インフォグラフィック -->
  <text x="1250" y="170" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">📊</text>
  <text x="1250" y="260" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">図解提案</text>
  <text x="1250" y="320" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">構成案を生成</text>
  
  <!-- ニュース -->
  <text x="2083" y="170" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">📰</text>
  <text x="2083" y="260" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">ニュース</text>
  <text x="2083" y="320" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">最新市場情報</text>
  
  <!-- Row 2 -->
  <!-- ブレインダンプ -->
  <text x="416" y="590" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">💡</text>
  <text x="416" y="680" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">アイデア</text>
  <text x="416" y="740" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">整理・分類</text>
  
  <!-- カテゴリ一覧 -->
  <text x="1250" y="590" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">📋</text>
  <text x="1250" y="680" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">カテゴリ</text>
  <text x="1250" y="740" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">分類を確認</text>
  
  <!-- ヘルプ -->
  <text x="2083" y="590" text-anchor="middle" fill="url(#gold)" font-size="72" font-family="sans-serif" font-weight="bold">❓</text>
  <text x="2083" y="680" text-anchor="middle" fill="#e8d48b" font-size="48" font-family="sans-serif" font-weight="bold">ヘルプ</text>
  <text x="2083" y="740" text-anchor="middle" fill="#8888aa" font-size="32" font-family="sans-serif">使い方を表示</text>
</svg>`;
}

// ─── Rich Menu Definition ───
function getRichMenuDefinition(): RichMenuObject {
  const colW = Math.floor(2500 / 3);
  const rowH = Math.floor(843 / 2);

  return {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "投資家Fアシスタント メニュー",
    chatBarText: "メニューを開く",
    areas: [
      // Row 1
      {
        bounds: { x: 0, y: 0, width: colW, height: rowH },
        action: { type: "message", text: "/xpost 今日のマーケット分析" },
      },
      {
        bounds: { x: colW, y: 0, width: colW, height: rowH },
        action: { type: "message", text: "/infographic 今週の市場動向" },
      },
      {
        bounds: { x: colW * 2, y: 0, width: 2500 - colW * 2, height: rowH },
        action: { type: "message", text: "/news" },
      },
      // Row 2
      {
        bounds: { x: 0, y: rowH, width: colW, height: 843 - rowH },
        action: { type: "message", text: "アイデアを整理したい" },
      },
      {
        bounds: { x: colW, y: rowH, width: colW, height: 843 - rowH },
        action: { type: "message", text: "/categories" },
      },
      {
        bounds: { x: colW * 2, y: rowH, width: 2500 - colW * 2, height: 843 - rowH },
        action: { type: "message", text: "/help" },
      },
    ],
  };
}

// ─── Setup Rich Menu ───
export async function setupRichMenu(): Promise<{ success: boolean; richMenuId?: string; error?: string }> {
  try {
    // 1. Delete existing rich menus
    const existing = await getRichMenuList();
    for (const menu of existing.richmenus) {
      await deleteRichMenu(menu.richMenuId);
    }

    // 2. Create new rich menu
    const menuDef = getRichMenuDefinition();
    const { richMenuId } = await createRichMenu(menuDef);

    // 3. Generate and upload image
    const svg = generateRichMenuSVG();
    // Convert SVG to PNG using sharp or a simple approach
    // For simplicity, we'll upload the SVG converted to a basic PNG
    const svgBuffer = Buffer.from(svg, "utf-8");
    
    // Use a simple approach: fetch a rendered version or use the SVG directly
    // LINE API requires PNG or JPEG, so we need to convert
    // We'll use a server-side canvas approach
    const { createCanvas } = await import("canvas");
    const canvas = createCanvas(2500, 843);
    const ctx = canvas.getContext("2d");
    
    // Draw background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 2500, 843);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(1, "#16213e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2500, 843);
    
    // Draw grid lines
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(833, 0); ctx.lineTo(833, 843);
    ctx.moveTo(1667, 0); ctx.lineTo(1667, 843);
    ctx.moveTo(0, 421); ctx.lineTo(2500, 421);
    ctx.stroke();
    
    // Draw button labels
    const buttons = [
      { emoji: "✍️", label: "X投稿", sub: "投稿案を生成", x: 416, y: 170 },
      { emoji: "📊", label: "図解提案", sub: "構成案を生成", x: 1250, y: 170 },
      { emoji: "📰", label: "ニュース", sub: "最新市場情報", x: 2083, y: 170 },
      { emoji: "💡", label: "アイデア", sub: "整理・分類", x: 416, y: 590 },
      { emoji: "📋", label: "カテゴリ", sub: "分類を確認", x: 1250, y: 590 },
      { emoji: "❓", label: "ヘルプ", sub: "使い方を表示", x: 2083, y: 590 },
    ];
    
    for (const btn of buttons) {
      // Emoji
      ctx.font = "72px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8d48b";
      ctx.fillText(btn.emoji, btn.x, btn.y);
      
      // Label
      ctx.font = "bold 48px sans-serif";
      ctx.fillStyle = "#e8d48b";
      ctx.fillText(btn.label, btn.x, btn.y + 90);
      
      // Sub label
      ctx.font = "32px sans-serif";
      ctx.fillStyle = "#8888aa";
      ctx.fillText(btn.sub, btn.x, btn.y + 150);
    }
    
    const pngBuffer = canvas.toBuffer("image/png");
    await uploadRichMenuImage(richMenuId, pngBuffer, "image/png");

    // 4. Set as default
    await setDefaultRichMenu(richMenuId);

    return { success: true, richMenuId };
  } catch (e: any) {
    console.error("[RichMenu] Setup error:", e);
    return { success: false, error: e.message };
  }
}

export { getRichMenuList, deleteRichMenu };
