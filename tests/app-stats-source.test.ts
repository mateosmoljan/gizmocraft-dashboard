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

test("sidebar no longer shows the confusing app users card", () => {
  const shellSource = readFileSync("src/components/gizmo-shell.tsx", "utf8");
  assert.doesNotMatch(shellSource, /App users/);
  assert.doesNotMatch(shellSource, /active last 5 min/);
  assert.doesNotMatch(shellSource, /Google users total/);
  assert.doesNotMatch(shellSource, /Live app activity only, not Minecraft players/);
  assert.doesNotMatch(shellSource, /api\/app-stats|APP_STATS|touchAppActivity|ShellDataSkeleton/);
});
