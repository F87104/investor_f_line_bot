import { describe, expect, it, vi, beforeEach } from "vitest";
import * as lineModule from "./line";

// Mock the line module
vi.mock("./line", () => ({
  createRichMenu: vi.fn().mockResolvedValue({ richMenuId: "test-rich-menu-id" }),
  uploadRichMenuImage: vi.fn().mockResolvedValue(undefined),
  setDefaultRichMenu: vi.fn().mockResolvedValue(undefined),
  deleteRichMenu: vi.fn().mockResolvedValue(undefined),
  getRichMenuList: vi.fn().mockResolvedValue({ richmenus: [] }),
}));

// Mock sharp
vi.mock("sharp", () => {
  return {
    default: vi.fn().mockReturnValue({
      resize: vi.fn().mockReturnValue({
        png: vi.fn().mockReturnValue({
          toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-png-data")),
        }),
      }),
    }),
  };
});

// Mock global fetch for CDN image download
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
});
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mock
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  });
  // Reset line module mocks
  vi.mocked(lineModule.createRichMenu).mockResolvedValue({ richMenuId: "test-rich-menu-id" });
  vi.mocked(lineModule.uploadRichMenuImage).mockResolvedValue(undefined);
  vi.mocked(lineModule.setDefaultRichMenu).mockResolvedValue(undefined);
  vi.mocked(lineModule.deleteRichMenu).mockResolvedValue(undefined);
  vi.mocked(lineModule.getRichMenuList).mockResolvedValue({ richmenus: [] } as any);
});

describe("Rich Menu Setup", () => {
  it("setupRichMenu creates, uploads image, and sets default", async () => {
    const { setupRichMenu } = await import("./richmenu");

    const result = await setupRichMenu();

    expect(result.success).toBe(true);
    expect(result.richMenuId).toBe("test-rich-menu-id");
    expect(lineModule.getRichMenuList).toHaveBeenCalled();
    expect(lineModule.createRichMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 2500, height: 843 },
        selected: true,
        name: expect.any(String),
        chatBarText: expect.any(String),
        areas: expect.arrayContaining([
          expect.objectContaining({
            bounds: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            action: expect.objectContaining({ type: "message" }),
          }),
        ]),
      })
    );
    expect(lineModule.uploadRichMenuImage).toHaveBeenCalledWith(
      "test-rich-menu-id",
      expect.any(Buffer),
      "image/png"
    );
    expect(lineModule.setDefaultRichMenu).toHaveBeenCalledWith("test-rich-menu-id");
  });

  it("setupRichMenu deletes existing menus before creating new one", async () => {
    vi.mocked(lineModule.getRichMenuList).mockResolvedValueOnce({
      richmenus: [
        { richMenuId: "old-menu-1" } as any,
        { richMenuId: "old-menu-2" } as any,
      ],
    });

    const { setupRichMenu } = await import("./richmenu");
    await setupRichMenu();

    expect(lineModule.deleteRichMenu).toHaveBeenCalledWith("old-menu-1");
    expect(lineModule.deleteRichMenu).toHaveBeenCalledWith("old-menu-2");
  });

  it("setupRichMenu returns error on failure", async () => {
    vi.mocked(lineModule.createRichMenu).mockRejectedValueOnce(new Error("API error"));

    const { setupRichMenu } = await import("./richmenu");
    const result = await setupRichMenu();

    expect(result.success).toBe(false);
    expect(result.error).toBe("API error");
  });

  it("rich menu has 6 areas for the 6 buttons", async () => {
    const { setupRichMenu } = await import("./richmenu");

    await setupRichMenu();

    const callArgs = vi.mocked(lineModule.createRichMenu).mock.calls;
    const lastCall = callArgs[callArgs.length - 1][0];
    expect(lastCall.areas).toHaveLength(6);

    // Verify button actions contain expected commands
    const actions = lastCall.areas.map((a: any) => a.action.text);
    expect(actions.some((t: string) => t.includes("/xpost"))).toBe(true);
    expect(actions.some((t: string) => t.includes("/infographic"))).toBe(true);
    expect(actions.some((t: string) => t.includes("/news"))).toBe(true);
    expect(actions.some((t: string) => t.includes("/help"))).toBe(true);
  });
});
