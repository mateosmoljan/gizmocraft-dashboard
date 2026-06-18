import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const ORIGINAL_ENV = { ...process.env };
let importCounter = 0;

async function importDashboardDataFresh() {
  importCounter += 1;
  return import(`../src/lib/dashboard-data.ts?test=${importCounter}`);
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  // @ts-expect-error test cleanup restores the fetch implementation.
  global.fetch = undefined;
});

test("configured production bridge does not fall back to sample players when auth fails", async () => {
  process.env.MINECRAFT_BRIDGE_URL = "https://bridge.example/api";
  process.env.MINECRAFT_BRIDGE_TOKEN = "wrong-token";
  global.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) as any;

  const { getDashboardData } = await importDashboardDataFresh();
  const data = await getDashboardData();

  assert.equal(data.live, false);
  assert.equal(data.players.length, 0);
  assert.equal(data.worldStats.trackedPlayers, 0);
  assert.match(data.worldStats.lastSync, /unavailable/);
  assert.match(data.error ?? "", /bridge leaderboards 401/);
});

test("manual dashboard refresh syncs the bridge before reading leaderboards", async () => {
  process.env.MINECRAFT_BRIDGE_URL = "https://bridge.example/api";
  const calls: string[] = [];
  global.fetch = async (input: any, init?: any) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return new Response(JSON.stringify({ world: { name: "Gizmo", lastSync: null }, players: [{ uuid: "u", name: "Mateo" }] }), { status: 200 }) as any;
  };

  const { getDashboardData } = await importDashboardDataFresh();
  await getDashboardData({ sync: true });

  assert.deepEqual(calls, ["POST https://bridge.example/api/api/sync", "GET https://bridge.example/api/api/leaderboards"]);
});

test("unconfigured local bridge keeps invented player stats empty when offline", async () => {
  delete process.env.MINECRAFT_BRIDGE_URL;
  global.fetch = async () => { throw new Error("offline"); };

  const { getDashboardData } = await importDashboardDataFresh();
  const data = await getDashboardData();

  assert.equal(data.live, false);
  assert.equal(data.players.length, 0);
  assert.equal(data.worldStats.lastSync, "waiting for live data");
});
