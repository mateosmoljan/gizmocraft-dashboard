import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard fetches automatically with value-level skeletons and no manual fallback refresh", () => {
  const dashboardSource = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(dashboardSource, /const LIVE_REFRESH_MS = 30_000/);
  assert.match(dashboardSource, /useState<DashboardData \| null>\(null\)/);
  assert.match(dashboardSource, /const loading = data === null/);
  assert.match(dashboardSource, /fetch\(`\/api\/dashboard\?ts=\$\{Date\.now\(\)\}\$\{syncBridge \? "&refresh=1" : ""\}`,[\s\S]*cache: "no-store"/);
  assert.match(dashboardSource, /const refreshInFlight = useRef\(false\)/);
  assert.match(dashboardSource, /if \(refreshInFlight\.current\) return/);
  assert.doesNotMatch(dashboardSource, /readClientCache|writeClientCache|last-dashboard-data/);
  assert.doesNotMatch(dashboardSource, /onRefresh|Showing last loaded data|Last loaded data/);
  assert.match(dashboardSource, /void refreshVisibleDashboard\(true\)/);
  assert.match(dashboardSource, /window\.setInterval\(\(\) => void refreshVisibleDashboard\(true\), LIVE_REFRESH_MS\)/);
  assert.match(dashboardSource, /document\.visibilityState !== "visible"/);
  assert.match(dashboardSource, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(dashboardSource, /if \(document\.visibilityState === "visible"\) void refreshVisibleDashboard\(true\)/);
  assert.doesNotMatch(dashboardSource, /GizmoCraft Command|Minecraft Overview|Player cards|Rivalry boards|Edit profile/);
  assert.doesNotMatch(dashboardSource, /Auto-refreshes every 30s while open/);
  assert.match(dashboardSource, /Online players/);
  assert.match(dashboardSource, /Last sessions/);
  assert.match(dashboardSource, /<table className=/);
  assert.doesNotMatch(dashboardSource, /Website fetch|Last database sync|Top score|Current king/);
});
