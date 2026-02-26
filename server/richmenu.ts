import {
  createRichMenu, uploadRichMenuImage, setDefaultRichMenu,
  deleteRichMenu, getRichMenuList, type RichMenuObject,
} from "./line";

// ─── Rich Menu Image ───
// Ultra-compressed JPEG (45KB, 2500x843) hosted on CDN - well under LINE's 1MB limit
// No runtime image processing needed - avoids sharp/canvas dependency issues in deploy
const RICH_MENU_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663341987478/pjkWPTtdzZkzZqTG.jpg";

async function fetchRichMenuImage(): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(RICH_MENU_IMAGE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch rich menu image: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[RichMenu] Image fetched: ${(buffer.length / 1024).toFixed(0)}KB (pre-compressed JPEG)`);

  // Verify size is under LINE's 1MB limit
  if (buffer.length > 1024 * 1024) {
    throw new Error(`Rich menu image too large: ${(buffer.length / 1024).toFixed(0)}KB (max 1024KB)`);
  }

  return { buffer, contentType: "image/jpeg" };
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
      // Row 1: X投稿 | 図解提案 | ニュース
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
      // Row 2: AI要約 | カテゴリ | ヘルプ
      {
        bounds: { x: 0, y: rowH, width: colW, height: 843 - rowH },
        action: { type: "message", text: "/summary" },
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

    // 3. Download pre-compressed image from CDN (no sharp needed)
    const { buffer, contentType } = await fetchRichMenuImage();
    await uploadRichMenuImage(richMenuId, buffer, contentType);

    // 4. Set as default
    await setDefaultRichMenu(richMenuId);

    return { success: true, richMenuId };
  } catch (e: any) {
    console.error("[RichMenu] Setup error:", e);
    return { success: false, error: e.message };
  }
}

export { getRichMenuList, deleteRichMenu };
