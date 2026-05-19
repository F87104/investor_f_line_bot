import { describe, expect, it } from "vitest";

describe("Slack secrets validation", () => {
  it("SLACK_BOT_TOKEN is set and starts with xoxb-", () => {
    const token = process.env.SLACK_BOT_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
    expect(token!.startsWith("xoxb-")).toBe(true);
  });

  it("SLACK_SIGNING_SECRET is set and has valid length", () => {
    const secret = process.env.SLACK_SIGNING_SECRET;
    expect(secret).toBeDefined();
    expect(secret!.length).toBeGreaterThanOrEqual(20);
  });

  it("SLACK_BOT_TOKEN can authenticate with Slack API", async () => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return;

    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    expect(data.ok).toBe(true);
  });
});
