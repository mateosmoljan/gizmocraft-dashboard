import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseRegionFileName, regionToBlockBounds, emptyWorldMapData, mapMemoryMetadata, GIZMOCRAFT_WORLD_SYNC_MODPACK, WORLD_MAP_CLIENT_CACHE_KEY, normalizeWorldMapTelemetry, mergeTrackingTelemetry } from "../src/lib/world-map";

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
  assert.equal(data.mapMemory.clientCacheKey, WORLD_MAP_CLIENT_CACHE_KEY);
  assert.equal(data.mapMemory.version, "offline-empty");
  assert.match(data.error ?? "", /offline/);
});

test("mapMemoryMetadata describes shared server-stored map memory", () => {
  const data = emptyWorldMapData();
  const memory = mapMemoryMetadata({
    ...data,
    world: { ...data.world, regionCount: 2, discoveredChunks: 2048, lastScan: "scan-a" },
    regions: [
      { id: "0:0", regionX: 0, regionZ: 0, minBlockX: 0, minBlockZ: 0, maxBlockX: 511, maxBlockZ: 511, chunkCount: 1024 },
      { id: "1:0", regionX: 1, regionZ: 0, minBlockX: 512, minBlockZ: 0, maxBlockX: 1023, maxBlockZ: 511, chunkCount: 1024 },
    ],
  });
  assert.equal(memory.mode, "server-stored-shared-memory");
  assert.equal(memory.clientCacheKey, WORLD_MAP_CLIENT_CACHE_KEY);
  assert.match(memory.storage, /gizmocraft-map\/coverage\.json/);
  assert.match(memory.strategy.join(" "), /shared JSON artifact/);
});

test("world sync modpack download metadata points at a public auto-installing zip", () => {
  assert.equal(GIZMOCRAFT_WORLD_SYNC_MODPACK.fileName, "gizmocraft-world-sync-modpack.zip");
  assert.match(GIZMOCRAFT_WORLD_SYNC_MODPACK.href, /^\/downloads\/.*\.zip$/);
  assert.equal(GIZMOCRAFT_WORLD_SYNC_MODPACK.version, "0.2.2");
  assert.equal(GIZMOCRAFT_WORLD_SYNC_MODPACK.jarName, "gizmocraft-world-sync-client-0.2.2.jar");
  assert.equal(GIZMOCRAFT_WORLD_SYNC_MODPACK.shaderPackName, "Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip");
  assert.match(GIZMOCRAFT_WORLD_SYNC_MODPACK.status, /auto-install/);
});

test("world sync client source auto-installs verified Bliss shaderpack", () => {
  const source = readFileSync("client-mod/gizmocraft-world-sync-client/src/main/java/app/gizmocraft/worldsync/GizmoCraftWorldSyncClient.java", "utf8");
  assert.match(source, /CLIENT_VERSION = "0\.2\.2"/);
  assert.match(source, /installBlissShaderPack\(gameDir, cacheDir\)/);
  assert.match(source, /gameDir\.resolve\("shaderpacks"\)/);
  assert.match(source, /BLISS_SHADER_SHA512\.equalsIgnoreCase\(sha512/);
  assert.match(source, /HttpResponse\.BodyHandlers\.ofByteArray\(\)/);
});

test("world sync modpack zip includes Bliss shaderpack and the auto-installing client jar", async () => {
  const { execFileSync } = await import("node:child_process");
  const zipPath = "public/downloads/gizmocraft-world-sync-modpack.zip";
  const list = execFileSync("python3", ["-c", `import zipfile; z=zipfile.ZipFile('${zipPath}'); print('\\n'.join(i.filename for i in z.infolist()))`], { encoding: "utf8" });
  assert.match(list, /mods\/gizmocraft-world-sync-client-0\.2\.2\.jar/);
  assert.doesNotMatch(list, /mods\/gizmocraft-world-sync-client-0\.2\.0\.jar/);
  assert.match(list, /shaderpacks\/Bliss_v2\.1\.2_\(Chocapic13_Shaders_edit\)\.zip/);

  const sha512 = execFileSync("python3", ["-c", `import hashlib,zipfile; z=zipfile.ZipFile('${zipPath}'); print(hashlib.sha512(z.read('shaderpacks/Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip')).hexdigest())`], { encoding: "utf8" }).trim();
  assert.equal(sha512, "dafc60be4980ec40f40edc0f2625cb0976f3c9ce5ed86383146a120480826bb1de70ef5e38b7f1437294ed4d38c6ef3c82ebef0ae4e00b8cee165788c9c18280");
  assert.ok(readFileSync(zipPath).length > 1_700_000);
});

test("world map dashboard polls uncached live map data", () => {
  const source = readFileSync("src/components/world-map-dashboard.tsx", "utf8");
  assert.match(source, /window\.setInterval\(\(\) => void refresh\(false\), POLL_MS\)/);
  assert.match(source, /fetch\(`\/api\/world-map\?ts=\$\{Date\.now\(\)\}`, \{ cache: "no-store" \}\)/);
});

test("normalizeWorldMapTelemetry sanitizes live player coordinates and visited chunk", () => {
  const telemetry = normalizeWorldMapTelemetry({
    player: { name: " Gizmeta ", uuid: "abc", x: 1567.8, y: 71.2, z: 9948.6 },
    visited: [{ x: 97, z: 621 }, { chunkX: 98, chunkZ: 622 }],
  }, "2026-06-14T16:40:00.000Z");

  assert.equal(telemetry.player.name, "Gizmeta");
  assert.equal(telemetry.player.x, 1567.8);
  assert.equal(telemetry.player.chunkX, 97);
  assert.equal(telemetry.player.chunkZ, 621);
  assert.deepEqual(telemetry.visitedChunks.map((chunk) => chunk.id), ["97:621", "98:622"]);
  assert.equal(telemetry.lastSeenAt, "2026-06-14T16:40:00.000Z");
});

test("mergeTrackingTelemetry keeps live players and deduplicated visited chunks newest first", () => {
  const merged = mergeTrackingTelemetry({ available: true, status: "generated" }, [
    normalizeWorldMapTelemetry({ player: { name: "Gizmeta", x: 1567, y: 71, z: 9948 }, visited: [{ chunkX: 97, chunkZ: 621 }] }, "2026-06-14T16:40:00.000Z"),
    normalizeWorldMapTelemetry({ player: { name: "Gizmeta", x: 1600, y: 72, z: 9950 }, visited: [{ chunkX: 100, chunkZ: 621 }, { chunkX: 97, chunkZ: 621 }] }, "2026-06-14T16:41:00.000Z"),
  ]);

  assert.equal(merged.status, "live-client-telemetry");
  assert.equal(merged.livePlayers?.length, 1);
  assert.equal(merged.livePlayers?.[0].x, 1600);
  assert.deepEqual(merged.visitedChunks?.map((chunk) => chunk.id), ["100:621", "97:621"]);
});
