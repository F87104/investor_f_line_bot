import { describe, expect, it } from "vitest";

describe("LINE API secrets", () => {
  it("LINE_CHANNEL_SECRET is set and non-empty", () => {
    const secret = process.env.LINE_CHANNEL_SECRET;
    expect(secret).toBeDefined();
    expect(secret!.length).toBeGreaterThan(0);
  });

  it("LINE_CHANNEL_ACCESS_TOKEN is set and non-empty", () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(0);
  });

  it("LINE_CHANNEL_ID is set and non-empty", () => {
    const id = process.env.LINE_CHANNEL_ID;
    expect(id).toBeDefined();
    expect(id!.length).toBeGreaterThan(0);
  });
});
