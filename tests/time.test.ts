import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatZagrebDateTime, formatZagrebTime } from "../src/lib/time";

describe("Zagreb timezone formatting", () => {
  it("formats dashboard timestamps explicitly in Europe/Zagreb", () => {
    assert.equal(formatZagrebTime("2026-01-01T12:00:00.000Z"), "13:00:00 Zagreb");
    assert.match(formatZagrebDateTime("2026-06-01T12:00:00.000Z"), /14:00 Zagreb$/);
  });
});
