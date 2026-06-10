import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gizmoNavItems } from "../src/lib/navigation";

describe("gizmo navigation", () => {
  it("puts overview, world map, player, board, tracking, usage, profile directory, and settings routes in the left sidebar order", () => {
    assert.deepEqual(gizmoNavItems.map((item) => item.href), ["/dashboard", "/world", "/players", "/leaderboards", "/tracking", "/usage", "/profiles", "/profile"]);
  });
});
