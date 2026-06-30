import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boards } from "../src/lib/sample-data";

test("leaderboard boards include more scannable statistics", () => {
  assert.equal(boards.length, 20);
  assert.deepEqual(boards.map((board) => board.title), [
    "Overall MVP",
    "Richest Miner",
    "Tunnel Goblin",
    "Builder Flex",
    "Craft Goblin",
    "Mob Menace",
    "Heavy Hitter",
    "Pain Sponge",
    "Untouchable",
    "Death Tax",
    "Respawn Regular",
    "Wanderer",
    "Homebody",
    "Addict Board",
    "Casual Visitor",
    "Food Vacuum",
    "Snack Minimalist",
    "Ore Accountant",
    "Pacifist Watch",
    "Score Underdog",
  ]);
  assert.ok(boards.some((board) => board.field === "score"));
  assert.ok(boards.some((board) => board.field === "damageDealt"));
  assert.ok(boards.some((board) => board.field === "blocksPlaced"));
  assert.equal(boards.filter((board) => "ascending" in board && board.ascending).length, 7);
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
  assert.doesNotMatch(source, /MiniMetric/);
  assert.doesNotMatch(source, /label="Players"/);
  assert.doesNotMatch(source, /label="Sort"/);
  assert.doesNotMatch(source, /Low wins|High wins/);
  assert.doesNotMatch(source, /Refresh data|Refresh now|Showing last loaded/);
});
