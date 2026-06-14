#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function parseProperties(text) {
  const props = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    props.set(key.trim(), rest.join("=").trim());
  }
  return props;
}

function parseRegionFileName(fileName) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(String(fileName));
  if (!match) return null;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  if (!Number.isInteger(regionX) || !Number.isInteger(regionZ)) return null;
  return { regionX, regionZ };
}

function regionBounds(regionX, regionZ) {
  const minBlockX = regionX * 512;
  const minBlockZ = regionZ * 512;
  return {
    minBlockX,
    minBlockZ,
    maxBlockX: minBlockX + 511,
    maxBlockZ: minBlockZ + 511,
  };
}

async function firstExistingDir(candidates) {
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) return candidate;
    } catch {}
  }
  return candidates[0];
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function mergeBounds(regions) {
  if (!regions.length) return null;
  return {
    minX: Math.min(...regions.map((region) => region.minBlockX)),
    minZ: Math.min(...regions.map((region) => region.minBlockZ)),
    maxX: Math.max(...regions.map((region) => region.maxBlockX)),
    maxZ: Math.max(...regions.map((region) => region.maxBlockZ)),
  };
}

function tilePyramid(bounds) {
  if (!bounds) return null;
  const widthBlocks = bounds.maxX - bounds.minX + 1;
  const heightBlocks = bounds.maxZ - bounds.minZ + 1;
  const maxDim = Math.max(widthBlocks, heightBlocks);
  const maxZoom = Math.max(0, Math.ceil(Math.log2(Math.max(1, maxDim / 256))));
  return {
    scheme: "minecraft-xz-slippy-v1",
    tileSize: 256,
    minZoom: 0,
    maxZoom,
    origin: { x: 0, z: 0 },
    bounds,
    urlTemplate: "/public/world-map-artifacts/tiles/{z}/{x}/{y}.png",
    note: "Tile image generation is the next layer; this manifest defines stable coordinates first.",
  };
}

async function main() {
  const serverRoot = process.env.MINECRAFT_SERVER_ROOT || "/home/cisco/minecraft-servers/gizmo-ivan";
  const propertiesPath = path.join(serverRoot, "server.properties");
  const properties = parseProperties(await readFile(propertiesPath, "utf8"));
  const worldName = process.env.MINECRAFT_WORLD_NAME || properties.get("level-name") || "world";
  const worldRoot = path.join(serverRoot, worldName);
  const artifactsDir = process.env.MINECRAFT_MAP_ARTIFACTS_DIR || path.join(serverRoot, "gizmocraft-map");
  const manifestPath = process.env.MINECRAFT_MAP_MANIFEST || path.join(artifactsDir, "manifest.json");
  const coveragePath = path.join(artifactsDir, "coverage.json");
  const regionDir = await firstExistingDir([
    path.join(worldRoot, "dimensions/minecraft/overworld/region"),
    path.join(worldRoot, "region"),
  ]);

  const entries = await readdir(regionDir);
  const regions = [];
  for (const fileName of entries) {
    const parsed = parseRegionFileName(fileName);
    if (!parsed) continue;
    const filePath = path.join(regionDir, fileName);
    const info = await stat(filePath).catch(() => null);
    regions.push({
      id: `${parsed.regionX}:${parsed.regionZ}`,
      ...parsed,
      ...regionBounds(parsed.regionX, parsed.regionZ),
      chunkCount: 1024,
      fileName,
      updatedAt: info?.mtime ? info.mtime.toISOString() : null,
    });
  }
  regions.sort((a, b) => Math.hypot(a.regionX, a.regionZ) - Math.hypot(b.regionX, b.regionZ) || a.regionX - b.regionX || a.regionZ - b.regionZ);

  const loadedBlockBounds = mergeBounds(regions);
  const generatedAt = new Date().toISOString();
  const viewDistance = Number(properties.get("view-distance") || 0);
  const simulationDistance = Number(properties.get("simulation-distance") || 0);
  const coverage = {
    status: "generated",
    generatedAt,
    world: worldName,
    dimension: "overworld",
    source: `${serverRoot}/${worldName}`,
    sourceRegionDir: regionDir,
    viewDistance,
    simulationDistance,
    viewRadiusBlocks: Number.isFinite(viewDistance) ? viewDistance * 16 : null,
    simulationRadiusBlocks: Number.isFinite(simulationDistance) ? simulationDistance * 16 : null,
    regionCount: regions.length,
    discoveredChunks: regions.reduce((sum, region) => sum + region.chunkCount, 0),
    loadedBlockBounds,
    tilePyramid: tilePyramid(loadedBlockBounds),
    regions,
  };

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");

  const manifest = await readJsonIfExists(manifestPath, {});
  const nextManifest = {
    ...manifest,
    status: "generated",
    generatedAt: manifest.generatedAt || generatedAt,
    source: manifest.source || `${serverRoot}/${worldName}`,
    method: manifest.method || "world-region-coverage-scan",
    mapMemory: {
      mode: "server-stored-shared-memory",
      storage: coveragePath,
      refreshSeconds: 15,
      cache: "shared coverage JSON now; immutable terrain tiles later",
    },
    coverage: {
      path: "coverage.json",
      generatedAt,
      regionCount: coverage.regionCount,
      discoveredChunks: coverage.discoveredChunks,
      loadedBlockBounds,
      tilePyramid: coverage.tilePyramid,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ coveragePath, manifestPath, regionCount: coverage.regionCount, discoveredChunks: coverage.discoveredChunks, loadedBlockBounds }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
