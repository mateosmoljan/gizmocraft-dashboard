import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard data syncs and refreshes from the API on load, manually, visibility return, and every 30 seconds", () => {
  const dashboardSource = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(dashboardSource, /const LIVE_REFRESH_MS = 30_000/);
  assert.match(dashboardSource, /fetch\(`\/api\/dashboard\?ts=\$\{Date\.now\(\)\}\$\{syncBridge \? "&refresh=1" : ""\}`,[\s\S]*cache: "no-store"/);
  assert.match(dashboardSource, /const refreshInFlight = useRef\(false\)/);
  assert.match(dashboardSource, /if \(refreshInFlight\.current\) return/);
  assert.match(dashboardSource, /onRefresh=\{\(\) => void refresh\(true, true\)\}/);
  assert.match(dashboardSource, /void refreshVisibleDashboard\(true\)/);
  assert.match(dashboardSource, /window\.setInterval\(\(\) => void refreshVisibleDashboard\(true\), LIVE_REFRESH_MS\)/);
  assert.match(dashboardSource, /document\.visibilityState !== "visible"/);
  assert.match(dashboardSource, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(dashboardSource, /if \(document\.visibilityState === "visible"\) void refreshVisibleDashboard\(true\)/);
  assert.match(dashboardSource, /setLastFetchedAt\(fetchedAt\)/);
  assert.match(dashboardSource, /Auto-refreshes every 30s while open/);
  assert.match(dashboardSource, /Website fetch/);
  assert.match(dashboardSource, /Last database sync/);
});
