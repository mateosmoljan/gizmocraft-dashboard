import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = () => readFileSync("bridge/src/server.js", "utf8");

test("bridge public profiles include signed-in Google users even when they are not linked to a Minecraft player", () => {
  const server = source();
  assert.match(server, /SELECT u\.id AS user_id,u\.email,u\.username,u\.name AS user_name,u\.image,u\.minecraft_uuid/);
  assert.match(server, /COALESCE\(u\.sign_in_count,0\)>0/);
  assert.match(server, /profileForUserRow/);
});

test("bridge profile updates preserve existing custom avatar when the client omits image", () => {
  const server = source();
  assert.match(server, /const hasImage = Object\.prototype\.hasOwnProperty\.call\(req\.body \?\? \{\}, "image"\)/);
  assert.match(server, /const image = hasImage \? \(req\.body\?\.image \? String\(req\.body\.image\) : null\) : undefined/);
  assert.match(server, /image=COALESCE\(\?,image\)/);
});
