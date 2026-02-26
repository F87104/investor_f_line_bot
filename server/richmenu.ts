import {
  createRichMenu, uploadRichMenuImage, setDefaultRichMenu,
  deleteRichMenu, getRichMenuList, type RichMenuObject,
} from "./line";

// ─── Rich Menu Image ───
// AI-generated premium gold-themed image hosted on CDN
// 6-button layout: X投稿 | 図解提案 | ニュース | アイデア | カテゴリ | ヘルプ
const RICH_MENU_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663341987478/PSRnOsDpdrdzpNUp.png";

async function fetchRichMenuImage(): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(RICH_MENU_IMAGE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch rich menu image: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const sharp = (await import("sharp")).default;
  const MAX_SIZE = 900 * 1024; // 900KB to stay safely under LINE's 1MB limit

  // Resize to exactly 2500x843 as required by LINE API, output as JPEG for smaller file size
  let quality = 85;
  let compressedBuffer = await sharp(buffer)
    .resize(2500, 843, { fit: "cover" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  // Progressively reduce quality if still too large
  while (compressedBuffer.length > MAX_SIZE && quality > 30) {
    quality -= 10;
    compressedBuffer = await sharp(buffer)
      .resize(2500, 843, { fit: "cover" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  console.log(`[RichMenu] Image compressed: ${(compressedBuffer.length / 1024).toFixed(0)}KB (quality: ${quality})`);
  return { buffer: compressedBuffer, contentType: "image/jpeg" };
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
      // Row 2: アイデア | カテゴリ | ヘルプ
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

    // 3. Download AI-generated image from CDN and resize to LINE spec
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
