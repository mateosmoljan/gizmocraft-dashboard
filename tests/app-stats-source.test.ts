import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("bridge app-user total counts actual sign-ins, not Minecraft-only profiles", () => {
  const source = readFileSync("bridge/src/server.js", "utf8");
  assert.match(source, /const signedInWhere = "COALESCE\(sign_in_count,0\)>0 AND email NOT LIKE 'minecraft:%@gizmocraft\.local'"/);
  assert.match(source, /total_signed_in FROM users WHERE \$\{signedInWhere\}/);
  assert.doesNotMatch(source, /total_signed_in FROM users WHERE email IS NOT NULL/);
  assert.doesNotMatch(source, /VALUES \(UUID\(\),\?,\?,\?,'PLAYER',NOW\(3\),NOW\(3\),1,NOW\(3\),NOW\(3\)\)/);
});

test("app stats API separates public reads from signed-in heartbeat writes", () => {
  const routeSource = readFileSync("src/app/api/app-stats/route.ts", "utf8");
  assert.match(routeSource, /export async function GET\(\) \{\s*const stats = await readAppUserStats\(\)/);
  assert.match(routeSource, /export async function POST\(\)/);
  assert.match(routeSource, /touchAndReadAppUserStats/);
});

test("sidebar preserves the all-time Google user total across refreshes", () => {
  const shellSource = readFileSync("src/components/gizmo-shell.tsx", "utf8");
  assert.match(shellSource, /APP_STATS_TOTAL_CACHE_KEY = "gizmocraft:max-google-users-total"/);
  assert.match(shellSource, /Math\.max\(previousTotal, Number\(stats\.totalSignedIn \?\? 0\)\)/);
  assert.match(shellSource, /method: "POST"/);
  assert.match(shellSource, /Showing saved Google total; live activity unavailable/);
});

test("sidebar preserves last active count during refresh heartbeat", () => {
  const shellSource = readFileSync("src/components/gizmo-shell.tsx", "utf8");
  assert.match(shellSource, /APP_STATS_ACTIVE_CACHE_KEY = "gizmocraft:last-active-app-users"/);
  assert.match(shellSource, /Math\.max\(previousOnline, Number\(stats\.online \?\? 0\)\)/);
  assert.doesNotMatch(shellSource, /setAppStats\(\{ online: 0, totalSignedIn: cachedTotal, live: false \}\)/);
});
