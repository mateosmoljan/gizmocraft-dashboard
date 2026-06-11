import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScreenshotSyncHelperScript } from "@/lib/screenshot-sync-helper";

describe("screenshot sync helper", () => {
  it("builds a Windows helper that watches the Minecraft screenshots folder and posts to the app upload route", () => {
    const script = buildScreenshotSyncHelperScript({ player: "OtherPlayer", baseUrl: "https://gizmocraft-dashboard.vercel.app/" });

    assert.match(script, /OtherPlayer/);
    assert.match(script, /\.minecraft\\screenshots/);
    assert.match(script, /https:\/\/gizmocraft-dashboard\.vercel\.app/);
    assert.match(script, /api\/screenshots\/upload/);
    assert.match(script, /MultipartFormDataContent/);
  });
});
