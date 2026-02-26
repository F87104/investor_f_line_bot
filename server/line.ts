import crypto from "crypto";
import { ENV } from "./_core/env";

// ─── LINE Signature Verification ───
export function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("SHA256", ENV.lineChannelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// ─── LINE Messaging API ───
const LINE_API_BASE = "https://api.line.me/v2/bot";

async function lineApiRequest(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[LINE API] ${path} failed: ${res.status} ${text}`);
    throw new Error(`LINE API error: ${res.status} ${text}`);
  }
  return res.json();
}

// Reply to a specific message
export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  return lineApiRequest("/message/reply", { replyToken, messages });
}

// Push message to a specific user
export async function pushMessage(to: string, messages: LineMessage[]) {
  return lineApiRequest("/message/push", { to, messages });
}

// Get user profile
export async function getUserProfile(userId: string): Promise<{ displayName: string; userId: string }> {
  const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to get profile: ${res.status}`);
  }
  return res.json();
}

// ─── Message Types ───
export type LineTextMessage = {
  type: "text";
  text: string;
};

export type LineMessage = LineTextMessage;

// ─── Helper to create text messages ───
export function textMessage(text: string): LineTextMessage {
  return { type: "text", text };
}

// ─── Multicast to all active users ───
export async function multicastMessage(userIds: string[], messages: LineMessage[]) {
  if (userIds.length === 0) return;
  return lineApiRequest("/message/multicast", { to: userIds, messages });
}

// ─── Rich Menu API ───

// Create a rich menu
export async function createRichMenu(richMenu: RichMenuObject): Promise<{ richMenuId: string }> {
  const res = await fetch(`${LINE_API_BASE}/richmenu`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
    body: JSON.stringify(richMenu),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create rich menu failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Upload rich menu image
export async function uploadRichMenuImage(richMenuId: string, imageBuffer: Uint8Array, contentType = "image/png"): Promise<void> {
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
    body: imageBuffer as any,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload rich menu image failed: ${res.status} ${text}`);
  }
}

// Set default rich menu
export async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set default rich menu failed: ${res.status} ${text}`);
  }
}

// Delete a rich menu
export async function deleteRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete rich menu failed: ${res.status} ${text}`);
  }
}

// Get list of rich menus
export async function getRichMenuList(): Promise<{ richmenus: RichMenuResponse[] }> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/list`, {
    headers: {
      Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get rich menu list failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── Rich Menu Types ───
export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: string; text?: string; label?: string; uri?: string };
};

export type RichMenuObject = {
  size: { width: 2500; height: 1686 | 843 };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
};

export type RichMenuResponse = RichMenuObject & { richMenuId: string };
