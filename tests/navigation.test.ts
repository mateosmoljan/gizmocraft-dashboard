import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gizmoNavItems } from "../src/lib/navigation";

describe("gizmo navigation", () => {
  it("puts overview, world map, screenshots, player, board, usage, profile directory, and settings routes in the left sidebar order", () => {
    assert.deepEqual(gizmoNavItems.map((item) => item.href), ["/dashboard", "/world", "/screenshots", "/players", "/leaderboards", "/usage", "/profiles", "/profile"]);
  });
});
