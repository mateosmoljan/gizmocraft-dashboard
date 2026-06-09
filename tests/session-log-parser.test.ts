import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore bridge scripts are runtime JS without TypeScript declarations.
import { parseMinecraftSessionEvents, pairMinecraftSessionEvents } from "../bridge/src/sync.js";

test("parses Minecraft join/leave logs with a real base date", () => {
  const events = parseMinecraftSessionEvents(
    [
      "[22:31:01] [Server thread/INFO]: Gizmeta joined the game",
      "[22:32:09] [Server thread/INFO]: Gizmeta left the game",
    ].join("\n"),
    new Date("2026-06-08T00:00:00Z"),
  );

  assert.equal(events.length, 2);
  assert.equal(events[0].playerName, "Gizmeta");
  assert.equal(events[0].action, "joined");
  assert.equal(events[0].occurredAt.toISOString(), "2026-06-08T22:31:01.000Z");
  assert.equal(events[1].occurredAt.toISOString(), "2026-06-08T22:32:09.000Z");
});

test("pairs only observed join/leave windows instead of inventing snapshot-length sessions", () => {
  const events = parseMinecraftSessionEvents(
    [
      "[21:25:43] [Server thread/INFO]: Gizmeta joined the game",
      "[21:26:03] [Server thread/INFO]: Gizmeta left the game",
      "[21:26:07] [Server thread/INFO]: Gizmeta joined the game",
      "[22:15:10] [Server thread/INFO]: Gizmeta left the game",
    ].join("\n"),
    new Date("2026-06-08T00:00:00Z"),
  );

  const sessions = pairMinecraftSessionEvents(events);

  assert.deepEqual(sessions.map((session: any) => ({
    playerName: session.playerName,
    joinedAt: session.joinedAt.toISOString(),
    leftAt: session.leftAt.toISOString(),
    durationMs: session.durationMs,
  })), [
    {
      playerName: "Gizmeta",
      joinedAt: "2026-06-08T21:25:43.000Z",
      leftAt: "2026-06-08T21:26:03.000Z",
      durationMs: 20_000,
    },
    {
      playerName: "Gizmeta",
      joinedAt: "2026-06-08T21:26:07.000Z",
      leftAt: "2026-06-08T22:15:10.000Z",
      durationMs: 2_943_000,
    },
  ]);
});

test("carries events across midnight within one log file", () => {
  const events = parseMinecraftSessionEvents(
    [
      "[23:58:29] [Server thread/INFO]: Gizmeta joined the game",
      "[00:01:20] [Server thread/INFO]: Gizmeta left the game",
    ].join("\n"),
    new Date("2026-06-02T00:00:00Z"),
  );

  const [session] = pairMinecraftSessionEvents(events);
  assert.equal(session.joinedAt.toISOString(), "2026-06-02T23:58:29.000Z");
  assert.equal(session.leftAt.toISOString(), "2026-06-03T00:01:20.000Z");
  assert.equal(session.durationMs, 171_000);
});
