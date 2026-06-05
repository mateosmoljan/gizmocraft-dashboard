import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { bridgeRequestInit } from "../src/lib/dashboard-data";

const originalToken = process.env.MINECRAFT_BRIDGE_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.MINECRAFT_BRIDGE_TOKEN;
  else process.env.MINECRAFT_BRIDGE_TOKEN = originalToken;
});

describe("bridge requests", () => {
  it("keeps bridge fetches server-cached without requiring a token locally", () => {
    delete process.env.MINECRAFT_BRIDGE_TOKEN;
    assert.deepEqual(bridgeRequestInit(), { next: { revalidate: 60 } });
  });

  it("sends the configured bridge bearer token when present", () => {
    process.env.MINECRAFT_BRIDGE_TOKEN = "secret-token";
    assert.deepEqual(bridgeRequestInit(), {
      next: { revalidate: 60 },
      headers: { authorization: "Bearer secret-token" },
    });
  });
});
