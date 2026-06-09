import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public profiles revalidate automatically instead of relying on fresh cached data", () => {
  const source = readFileSync("src/components/public-profiles.tsx", "utf8");

  assert.match(source, /void loadProfiles\(false\);/);
  assert.match(source, /setInterval\(\(\) => \{/);
  assert.match(source, /addEventListener\("focus", refreshOnFocus\)/);
  assert.doesNotMatch(source, /PROFILES_CACHE_TTL_MS/);
  assert.doesNotMatch(source, /cached\.fetchedAt[\s\S]*return/);
});
