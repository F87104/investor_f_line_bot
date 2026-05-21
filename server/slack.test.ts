import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { classifyMemoFolder, parseOrganizeScope, parsePhraseSelection, parseThreadReplyIntent, shouldHandleSlackEvent, verifySlackSignature } from "./slack";

function sign(secret: string, timestamp: string, rawBody: string) {
  const base = `v0:${timestamp}:${rawBody}`;
  return `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`;
}

describe("Slack signature verification", () => {
  it("accepts a valid Slack signature", () => {
    const secret = "test-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ type: "event_callback", event: { type: "app_mention" } });

    expect(verifySlackSignature(rawBody, timestamp, sign(secret, timestamp, rawBody), secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const secret = "test-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = "token=abc&text=hello";

    expect(verifySlackSignature("token=abc&text=bye", timestamp, sign(secret, timestamp, rawBody), secret)).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const secret = "test-secret";
    const timestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const rawBody = "token=abc&text=hello";

    expect(verifySlackSignature(rawBody, timestamp, sign(secret, timestamp, rawBody), secret)).toBe(false);
  });
});

describe("Slack event routing", () => {
  it("handles direct messages", () => {
    expect(shouldHandleSlackEvent({
      type: "message",
      user: "U123",
      text: "今日の気づき",
      channel: "D123",
      channel_type: "im",
    })).toBe(true);
  });

  it("handles only the configured memo channel for normal channel messages", () => {
    expect(shouldHandleSlackEvent({
      type: "message",
      user: "U123",
      text: "今日の気づき",
      channel: "C_MEMO",
      channel_type: "channel",
    }, "C_MEMO")).toBe(true);

    expect(shouldHandleSlackEvent({
      type: "message",
      user: "U123",
      text: "今日の気づき",
      channel: "C_OTHER",
      channel_type: "channel",
    }, "C_MEMO")).toBe(false);
  });

  it("ignores bot and subtype events", () => {
    expect(shouldHandleSlackEvent({
      type: "message",
      user: "U123",
      text: "今日の気づき",
      channel: "C_MEMO",
      bot_id: "B123",
    }, "C_MEMO")).toBe(false);

    expect(shouldHandleSlackEvent({
      type: "message",
      user: "U123",
      text: "今日の気づき",
      channel: "C_MEMO",
      subtype: "message_changed",
    }, "C_MEMO")).toBe(false);
  });
});

describe("Slack memo folder classification", () => {
  it("classifies investment memos", () => {
    expect(classifyMemoFolder("米国株は金利低下局面でグロースが強そう")).toBe("investment");
  });

  it("classifies idea memos", () => {
    expect(classifyMemoFolder("LINEとSlackをつなぐ新しいアプリのアイデア")).toBe("idea");
  });

  it("uses the LLM category when keywords are not obvious", () => {
    expect(classifyMemoFolder("あとで確認する", "task")).toBe("task");
    expect(classifyMemoFolder("自分の価値観を整理したい", "thought")).toBe("thought");
  });
});

describe("Slack thread reply intent", () => {
  it("continues the parent memo conversation by default", () => {
    expect(parseThreadReplyIntent("これを投資に応用すると？")).toEqual({
      mode: "continue",
      text: "これを投資に応用すると？",
    });
  });

  it("detects append replies", () => {
    expect(parseThreadReplyIntent("追記: 金利だけでなく決算も見る")).toEqual({
      mode: "append",
      text: "金利だけでなく決算も見る",
    });
  });

  it("detects explicit new memo replies", () => {
    expect(parseThreadReplyIntent("別メモ: 明日は決算資料を確認する")).toEqual({
      mode: "new_memo",
      text: "明日は決算資料を確認する",
    });
    expect(parseThreadReplyIntent("メモ 明日は決算資料を確認する")).toEqual({
      mode: "new_memo",
      text: "明日は決算資料を確認する",
    });
  });
});

describe("Slack phrase selection", () => {
  it("detects phrase candidate numbers", () => {
    expect(parsePhraseSelection("言葉1")).toBe(0);
    expect(parsePhraseSelection("言葉 2")).toBe(1);
    expect(parsePhraseSelection("表現３")).toBe(2);
    expect(parsePhraseSelection("フレーズ8")).toBe(7);
  });

  it("ignores normal phrase extraction requests", () => {
    expect(parsePhraseSelection("言葉")).toBe(null);
    expect(parsePhraseSelection("言葉をもっと")).toBe(null);
  });
});

describe("Slack organize scope", () => {
  it("detects organize ranges", () => {
    expect(parseOrganizeScope("整理")).toBe("recent");
    expect(parseOrganizeScope("整理 今日")).toBe("today");
    expect(parseOrganizeScope("整理 今週")).toBe("week");
    expect(parseOrganizeScope("整理 未処理")).toBe("unprocessed");
  });
});
