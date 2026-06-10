import { bridgeRequestInit } from "@/lib/dashboard-data";
import { formatZagrebDateTime } from "@/lib/time";

export type WorldMapRegion = {
  id: string;
  regionX: number;
  regionZ: number;
  minBlockX: number;
  minBlockZ: number;
  maxBlockX: number;
  maxBlockZ: number;
  chunkCount: number;
  updatedAt?: string | null;
};

export type WorldMapData = {
  world: {
    name: string;
    dimension: string;
    spawn: { x: number; z: number };
    regionCount: number;
    discoveredChunks: number;
    loadedBlockBounds: { minX: number; minZ: number; maxX: number; maxZ: number } | null;
    lastScan: string;
  };
  regions: WorldMapRegion[];
  live: boolean;
  visibility: {
    public: string[];
    signedIn: string[];
    restricted: string[];
  };
  error?: string;
};

export function bridgeUrlFromEnv() {
  return process.env.MINECRAFT_BRIDGE_URL?.trim() || "http://gizmo-server:3020";
}

export function parseRegionFileName(fileName: string) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(fileName);
  if (!match) return null;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  if (!Number.isInteger(regionX) || !Number.isInteger(regionZ)) return null;
  return { regionX, regionZ };
}

export function regionToBlockBounds(regionX: number, regionZ: number) {
  const minBlockX = regionX * 512;
  const minBlockZ = regionZ * 512;
  return {
    minBlockX,
    minBlockZ,
    maxBlockX: minBlockX + 511,
    maxBlockZ: minBlockZ + 511,
  };
}

export function emptyWorldMapData(error?: unknown): WorldMapData {
  return {
    world: {
      name: "Gizmo Ivan — Dole",
      dimension: "overworld",
      spawn: { x: 0, z: 0 },
      regionCount: 0,
      discoveredChunks: 0,
      loadedBlockBounds: null,
      lastScan: "live bridge unavailable",
    },
    regions: [],
    live: false,
    visibility: {
      public: ["Spawn origin", "Loaded/discovered region files", "Approximate chunk coverage", "Live scan time"],
      signedIn: ["Player-linked routes and profile overlays"],
      restricted: ["Individual player trails", "Private base markers", "Admin annotations"],
    },
    error: error ? String(error instanceof Error ? error.message : error) : undefined,
  };
}

export async function getWorldMapData(): Promise<WorldMapData> {
  try {
    const res = await fetch(`${bridgeUrlFromEnv()}/api/world-map`, {
      ...bridgeRequestInit(),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`bridge world-map ${res.status}`);
    const data = await res.json();
    return {
      ...data,
      world: {
        ...data.world,
        lastScan: data.world?.lastScan ? formatZagrebDateTime(data.world.lastScan) : "live bridge",
      },
      live: true,
    };
  } catch (error) {
    return emptyWorldMapData(error);
  }
}
