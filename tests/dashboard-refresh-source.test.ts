import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard data refreshes from the API on load, manually, and every 30 seconds", () => {
  const dashboardSource = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(dashboardSource, /const LIVE_REFRESH_MS = 30_000/);
  assert.match(dashboardSource, /fetch\(`\/api\/dashboard\?ts=\$\{Date\.now\(\)\}`,[\s\S]*cache: "no-store"/);
  assert.match(dashboardSource, /window\.setInterval\(\(\) => void refreshVisibleDashboard\(\), LIVE_REFRESH_MS\)/);
  assert.match(dashboardSource, /document\.visibilityState !== "visible"/);
  assert.match(dashboardSource, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(dashboardSource, /setLastFetchedAt\(fetchedAt\)/);
  assert.match(dashboardSource, /Auto-refreshes every 30s while open/);
  assert.match(dashboardSource, /Website fetch/);
  assert.match(dashboardSource, /Last database sync/);
});
