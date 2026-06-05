import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gizmoNavItems } from "../src/lib/navigation";

describe("gizmo navigation", () => {
  it("puts dashboard, profiles, and settings in the left sidebar order", () => {
    assert.deepEqual(gizmoNavItems.map((item) => item.href), ["/dashboard", "/profiles", "/profile"]);
  });
});
