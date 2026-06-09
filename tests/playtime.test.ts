import assert from "node:assert/strict";
import test from "node:test";
import { formatPlaytimeHours, formatPlaytimeMs } from "../src/lib/playtime";

test("formats Minecraft playtime from stat hours into compact days/hours/minutes", () => {
  assert.equal(formatPlaytimeHours(0), "0m");
  assert.equal(formatPlaytimeHours(1.5), "1h 30m");
  assert.equal(formatPlaytimeHours(5.32), "5h 19m");
  assert.equal(formatPlaytimeHours(25.25), "1d 1h");
});

test("formats persisted total playtime milliseconds from profile records", () => {
  assert.equal(formatPlaytimeMs(90_000), "2m");
  assert.equal(formatPlaytimeMs("5400000"), "1h 30m");
  assert.equal(formatPlaytimeMs(BigInt(91_800_000)), "1d 1h");
});
