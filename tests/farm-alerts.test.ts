import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error bridge code is plain ESM JavaScript.
import { detectFarmBehavior } from "../bridge/src/sync.js";

function stats({ playTicks = 0, mobKills = 0, blocksMined = 0, diamonds = 0, distanceCm = 0, blocksPlaced = 0, crafted = 0 } = {}) {
  return {
    stats: {
      "minecraft:custom": {
        "minecraft:play_time": playTicks,
        "minecraft:mob_kills": mobKills,
        "minecraft:walk_one_cm": distanceCm,
      },
      "minecraft:mined": {
        "minecraft:stone": blocksMined,
        "minecraft:diamond_ore": diamonds,
      },
      "minecraft:used": {
        "minecraft:cobblestone": blocksPlaced,
      },
      "minecraft:crafted": {
        "minecraft:stick": crafted,
      },
    },
  };
}

test("detectFarmBehavior flags likely stationary mob XP farms", () => {
  const previous = { raw_stats: JSON.stringify(stats({ playTicks: 0, mobKills: 0, distanceCm: 0 })) };
  const current = { uuid: "player-1", name: "Gizmeta", raw: stats({ playTicks: 12_000, mobKills: 130, distanceCm: 1_000 }) };
  const alerts = detectFarmBehavior(current, previous, new Date("2026-06-15T12:00:00Z"));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, "possible_xp_mob_farm");
  assert.equal(alerts[0].severity, "medium");
  assert.match(alerts[0].reason, /killed 130 mobs/);
});

test("detectFarmBehavior ignores short or normal play windows", () => {
  const previous = { raw_stats: JSON.stringify(stats({ playTicks: 0, mobKills: 0, blocksMined: 0 })) };
  assert.deepEqual(detectFarmBehavior({ uuid: "p", name: "Normal", raw: stats({ playTicks: 2_000, mobKills: 80 }) }, previous), []);
  assert.deepEqual(detectFarmBehavior({ uuid: "p", name: "Normal", raw: stats({ playTicks: 12_000, mobKills: 8, blocksMined: 50, distanceCm: 30_000 }) }, previous), []);
});

test("detectFarmBehavior flags resource saturation from mining and ores", () => {
  const previous = { raw_stats: JSON.stringify(stats({ playTicks: 0, blocksMined: 0, diamonds: 0 })) };
  const current = { uuid: "player-2", name: "Miner", raw: stats({ playTicks: 12_000, blocksMined: 800, diamonds: 20, distanceCm: 5_000 }) };
  const categories = detectFarmBehavior(current, previous).map((alert: { category: string }) => alert.category);
  assert.ok(categories.includes("possible_mining_grind"));
  assert.ok(categories.includes("possible_ore_saturation"));
});
