import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("profile onboarding asks non-negotiable Minecraft ownership question", () => {
  const source = readFileSync("src/components/profile-settings.tsx", "utf8");
  assert.match(source, /Minecraft identity \(required\)/);
  assert.match(source, /I already played on the GizmoCraft world/);
  assert.match(source, /I have Minecraft, but I have not played this world yet/);
  assert.match(source, /No Minecraft account yet/);
  assert.match(source, /minecraftStatus/);
});

test("profile save persists pending Minecraft username for future auto-linking", () => {
  const bridgeSource = readFileSync("bridge/src/server.js", "utf8");
  const syncSource = readFileSync("bridge/src/sync.js", "utf8");
  assert.match(bridgeSource, /minecraft_identity_preclaim/);
  assert.match(bridgeSource, /minecraftStatus/);
  assert.match(syncSource, /linkPendingMinecraftClaims/);
  assert.match(syncSource, /minecraft_identity_preclaim/);
});

test("profile update sanitizer accepts Minecraft status and preferences", () => {
  const source = readFileSync("src/lib/profile-model.ts", "utf8");
  assert.match(source, /minecraftStatus/);
  assert.match(source, /preferences/);
  assert.match(source, /played_before/);
  assert.match(source, /has_minecraft/);
  assert.match(source, /no_minecraft/);
});
