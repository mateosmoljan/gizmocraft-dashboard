import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("overview only shows online count and a last-sessions table", () => {
  const source = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(source, /<OverviewSection sessions=\{currentSessions\}/);
  assert.match(source, /Online players/);
  assert.match(source, /Last sessions/);
  assert.match(source, /<table className=/);
  assert.match(source, /<th className="px-5 py-3 font-black">Player<\/th>/);
  assert.match(source, /<th className="px-5 py-3 font-black">Joined<\/th>/);
  assert.match(source, /<th className="px-5 py-3 font-black">Left<\/th>/);
  assert.match(source, /Duration/);
  assert.doesNotMatch(source, /DashboardProfileSummary/);
  assert.doesNotMatch(source, /Top score/);
  assert.doesNotMatch(source, /Current king/);
  assert.doesNotMatch(source, /Quick jump/);
  assert.doesNotMatch(source, /Website fetch/);
});

test("bridge leaderboards payload includes recent sessions for overview", () => {
  const bridgeSource = readFileSync("bridge/src/server.js", "utf8");
  const dataSource = readFileSync("src/lib/dashboard-data.ts", "utf8");

  assert.match(bridgeSource, /FROM player_sessions ps JOIN players p ON p\.uuid=ps\.player_uuid/);
  assert.match(bridgeSource, /ORDER BY ps\.joined_at DESC, ps\.id DESC LIMIT 12/);
  assert.match(bridgeSource, /sessions,/);
  assert.match(dataSource, /export type DashboardSession/);
  assert.match(dataSource, /sessions: \(data\.sessions \?\? \[\]\)\.map/);
});
