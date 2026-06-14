import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const worldPageSource = readFileSync(new URL("../src/app/world/page.tsx", import.meta.url), "utf8");

describe("world page route", () => {
  it("renders the world map instead of redirecting signed-in users to overview", () => {
    assert.match(worldPageSource, /WorldMapDashboard/);
    assert.doesNotMatch(worldPageSource, /redirect\(["']\/dashboard["']\)/);
  });
});
