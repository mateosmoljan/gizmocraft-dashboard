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
  assert.match(dashboardSource, /const LIVE_REFRESH_MS = 30_000/);
  assert.match(dashboardSource, /window\.setInterval\(\(\) => void refreshLiveUsage\(false\), LIVE_REFRESH_MS\)/);
  assert.match(dashboardSource, /document\.visibilityState !== "visible"/);
  assert.match(dashboardSource, /fetch\(`\/api\/usage\?ts=\$\{Date\.now\(\)\}`/);
  assert.match(dashboardSource, /fetch\(`\/api\/server-settings\?ts=\$\{Date\.now\(\)\}`/);
});
