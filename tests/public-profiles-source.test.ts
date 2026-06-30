import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public profiles revalidate automatically without stale cache or a manual refresh button", () => {
  const source = readFileSync("src/components/public-profiles.tsx", "utf8");

  assert.match(source, /void loadProfiles\(\);/);
  assert.match(source, /setInterval\(\(\) => \{/);
  assert.match(source, /addEventListener\("focus", refreshOnFocus\)/);
  assert.match(source, /ProfileCardSkeleton/);
  assert.doesNotMatch(source, /readClientCache|writeClientCache|PROFILES_CACHE_KEY|PROFILES_CACHE_TTL_MS/);
  assert.doesNotMatch(source, /cached\.fetchedAt[\s\S]*return|>Refresh<|Refreshing…/);
});
