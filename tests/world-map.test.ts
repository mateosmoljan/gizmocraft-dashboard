import assert from "node:assert/strict";
import test from "node:test";
import { parseRegionFileName, regionToBlockBounds, emptyWorldMapData } from "../src/lib/world-map";

test("parseRegionFileName accepts Minecraft region names", () => {
  assert.deepEqual(parseRegionFileName("r.0.0.mca"), { regionX: 0, regionZ: 0 });
  assert.deepEqual(parseRegionFileName("r.-2.5.mca"), { regionX: -2, regionZ: 5 });
  assert.equal(parseRegionFileName("c.0.0.mca"), null);
  assert.equal(parseRegionFileName("r.0.0.tmp"), null);
});

test("regionToBlockBounds maps 32x32 chunk regions to block bounds", () => {
  assert.deepEqual(regionToBlockBounds(0, 0), { minBlockX: 0, minBlockZ: 0, maxBlockX: 511, maxBlockZ: 511 });
  assert.deepEqual(regionToBlockBounds(-1, 2), { minBlockX: -512, minBlockZ: 1024, maxBlockX: -1, maxBlockZ: 1535 });
});

test("emptyWorldMapData is safe for public fallback", () => {
  const data = emptyWorldMapData(new Error("offline"));
  assert.equal(data.live, false);
  assert.equal(data.world.regionCount, 0);
  assert.deepEqual(data.regions, []);
  assert.match(data.visibility.public.join(" "), /Spawn/);
  assert.match(data.error ?? "", /offline/);
});
