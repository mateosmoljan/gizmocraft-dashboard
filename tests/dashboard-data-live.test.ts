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

test("configured production bridge does not fall back to sample players when auth/sync fails", async () => {
  process.env.MINECRAFT_BRIDGE_URL = "https://bridge.example/api";
  process.env.MINECRAFT_BRIDGE_TOKEN = "wrong-token";
  global.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) as any;

  const { getDashboardData } = await importDashboardDataFresh();
  const data = await getDashboardData();

  assert.equal(data.live, false);
  assert.equal(data.players.length, 0);
  assert.equal(data.worldStats.trackedPlayers, 0);
  assert.match(data.worldStats.lastSync, /unavailable/);
  assert.match(data.error ?? "", /bridge sync 401/);
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
