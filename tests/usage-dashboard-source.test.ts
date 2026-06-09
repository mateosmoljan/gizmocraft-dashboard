import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("usage page labels active Minecraft players and does not overwrite fresh usage with stale cache", () => {
  const usageSource = readFileSync("src/lib/server-usage.ts", "utf8");
  assert.match(usageSource, /metric\("Active Minecraft players", activePlayerValue, activePlayerDetail\)/);
  assert.doesNotMatch(usageSource, /metric\("Players"[\s\S]*minecraft\.status\)/);

  const dashboardSource = readFileSync("src/components/usage-dashboard.tsx", "utf8");
  assert.match(dashboardSource, /if \(initialUsage\.live\)/);
  assert.match(dashboardSource, /writeClientCache\(USAGE_CACHE_KEY, initialUsage\)/);
});
