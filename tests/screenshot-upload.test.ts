import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeScreenshotPlayer, validateScreenshotFile } from "@/lib/screenshot-upload";

describe("screenshot upload validation", () => {
  it("accepts exact Minecraft usernames and rejects unsafe labels", () => {
    assert.equal(normalizeScreenshotPlayer("Gizmeta"), "Gizmeta");
    assert.equal(normalizeScreenshotPlayer("Player_123"), "Player_123");
    assert.equal(normalizeScreenshotPlayer("bad player"), null);
    assert.equal(normalizeScreenshotPlayer("this_name_is_way_too_long"), null);
  });

  it("allows common image screenshots only", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const txt = new File(["hello"], "shot.txt", { type: "text/plain" });

    assert.equal(validateScreenshotFile(png), null);
    assert.equal(validateScreenshotFile(txt), "Use PNG, JPEG, or WebP screenshots");
  });
});
