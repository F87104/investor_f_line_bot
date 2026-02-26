import { describe, expect, it, vi } from "vitest";

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
      png: vi.fn().mockReturnValue({
        toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-png-data")),
      }),
    }),
  };
});

describe("Rich Menu Setup", () => {
  it("setupRichMenu creates, uploads image, and sets default", async () => {
    const { setupRichMenu } = await import("./richmenu");
    const { createRichMenu, uploadRichMenuImage, setDefaultRichMenu, getRichMenuList } = await import("./line");

    const result = await setupRichMenu();

    expect(result.success).toBe(true);
    expect(result.richMenuId).toBe("test-rich-menu-id");
    expect(getRichMenuList).toHaveBeenCalled();
    expect(createRichMenu).toHaveBeenCalledWith(
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
    expect(uploadRichMenuImage).toHaveBeenCalledWith(
      "test-rich-menu-id",
      expect.any(Buffer),
      "image/png"
    );
    expect(setDefaultRichMenu).toHaveBeenCalledWith("test-rich-menu-id");
  });

  it("setupRichMenu deletes existing menus before creating new one", async () => {
    const { getRichMenuList, deleteRichMenu } = await import("./line");
    (getRichMenuList as any).mockResolvedValueOnce({
      richmenus: [{ richMenuId: "old-menu-1" }, { richMenuId: "old-menu-2" }],
    });

    const { setupRichMenu } = await import("./richmenu");
    await setupRichMenu();

    expect(deleteRichMenu).toHaveBeenCalledWith("old-menu-1");
    expect(deleteRichMenu).toHaveBeenCalledWith("old-menu-2");
  });

  it("setupRichMenu returns error on failure", async () => {
    const { createRichMenu } = await import("./line");
    (createRichMenu as any).mockRejectedValueOnce(new Error("API error"));

    const { setupRichMenu } = await import("./richmenu");
    const result = await setupRichMenu();

    expect(result.success).toBe(false);
    expect(result.error).toBe("API error");
  });

  it("rich menu has 6 areas for the 6 buttons", async () => {
    const { createRichMenu } = await import("./line");
    const { setupRichMenu } = await import("./richmenu");

    await setupRichMenu();

    const callArgs = (createRichMenu as any).mock.calls;
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
