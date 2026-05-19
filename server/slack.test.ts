import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "./slack";

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
