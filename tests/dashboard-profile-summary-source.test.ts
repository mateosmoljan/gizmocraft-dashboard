import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("overview profile summary omits ownership-mapping noise", () => {
  const source = readFileSync("src/components/dashboard-profile-summary.tsx", "utf8");

  assert.doesNotMatch(source, /Google ownership mapped|Needs ownership mapping/);
  assert.doesNotMatch(source, /Matched by the approved Google email mapping|Matched from your saved profile link/);
  assert.doesNotMatch(source, /Ask Mateo to attach/);
  assert.doesNotMatch(source, /Minecraft playtime:/);
  assert.match(source, /Open public profile/);
  assert.match(source, /Edit profile/);
});
