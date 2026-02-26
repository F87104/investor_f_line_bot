import {
  createRichMenu, uploadRichMenuImage, setDefaultRichMenu,
  deleteRichMenu, getRichMenuList, type RichMenuObject,
} from "./line";

// ─── Generate Rich Menu Image using SVG → PNG (sharp) ───
// LINE Rich Menu requires 2500x843 or 2500x1686 image in PNG/JPEG format

function generateRichMenuSVG(): string {
  // 2500x843 layout: 3 columns × 2 rows = 6 buttons
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="2500" height="843" fill="url(#bg)"/>
  
  <!-- Grid lines -->
  <line x1="833" y1="0" x2="833" y2="843" stroke="#2a2a4a" stroke-width="2"/>
  <line x1="1667" y1="0" x2="1667" y2="843" stroke="#2a2a4a" stroke-width="2"/>
  <line x1="0" y1="421" x2="2500" y2="421" stroke="#2a2a4a" stroke-width="2"/>
  
  <!-- Row 1 -->
  <text x="416" y="200" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">X Post</text>
  <text x="416" y="280" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">Generate Draft</text>
  
  <text x="1250" y="200" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">Infographic</text>
  <text x="1250" y="280" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">Structure Plan</text>
  
  <text x="2083" y="200" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">News</text>
  <text x="2083" y="280" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">Market Update</text>
  
  <!-- Row 2 -->
  <text x="416" y="620" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">Ideas</text>
  <text x="416" y="700" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">Brain Dump</text>
  
  <text x="1250" y="620" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">Categories</text>
  <text x="1250" y="700" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">View Tags</text>
  
  <text x="2083" y="620" text-anchor="middle" fill="#e8d48b" font-size="64" font-family="Arial, Helvetica, sans-serif" font-weight="bold">Help</text>
  <text x="2083" y="700" text-anchor="middle" fill="#8888aa" font-size="36" font-family="Arial, Helvetica, sans-serif">Commands</text>
</svg>`;
}

async function svgToPng(svg: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svgBuffer = Buffer.from(svg, "utf-8");
  return sharp(svgBuffer).png().toBuffer();
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

    // 3. Generate SVG and convert to PNG using sharp
    const svg = generateRichMenuSVG();
    const pngBuffer = await svgToPng(svg);
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
