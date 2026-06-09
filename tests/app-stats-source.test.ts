import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("bridge app-user total counts actual sign-ins, not Minecraft-only profiles", () => {
  const source = readFileSync("bridge/src/server.js", "utf8");
  assert.match(source, /const signedInWhere = "COALESCE\(sign_in_count,0\)>0"/);
  assert.match(source, /total_signed_in FROM users WHERE \$\{signedInWhere\}/);
  assert.doesNotMatch(source, /total_signed_in FROM users WHERE email IS NOT NULL/);
});
