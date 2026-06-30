import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boards } from "../src/lib/sample-data";

test("leaderboard boards include more scannable statistics", () => {
  assert.equal(boards.length, 12);
  assert.deepEqual(boards.map((board) => board.title), [
    "Overall MVP",
    "Richest Miner",
    "Tunnel Goblin",
    "Builder Flex",
    "Craft Goblin",
    "Mob Menace",
    "Heavy Hitter",
    "Pain Sponge",
    "Death Tax",
    "Wanderer",
    "Addict Board",
    "Food Vacuum",
  ]);
  assert.ok(boards.some((board) => board.field === "score"));
  assert.ok(boards.some((board) => board.field === "damageDealt"));
  assert.ok(boards.some((board) => board.field === "blocksPlaced"));
  assert.ok(new Set(boards.map((board) => board.category)).size >= 5);
});

test("leaderboard UI uses featured cards, category chips, top-three rows, and no manual refresh", () => {
  const source = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(source, /Rivalry center/);
  assert.match(source, /Boards that are easy to scan/);
  assert.match(source, /featuredBoards = boards\.slice\(0, 3\)/);
  assert.match(source, /categories = Array\.from\(new Set\(boards\.map/);
  assert.match(source, /function BoardCard/);
  assert.match(source, /Current leader/);
  assert.match(source, /Top 3/);
  assert.match(source, /Low wins/);
  assert.match(source, /High wins/);
  assert.doesNotMatch(source, /Refresh data|Refresh now|Showing last loaded/);
});
