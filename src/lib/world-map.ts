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

export type WorldMapTrackingArtifact = {
  id: string;
  label: string;
  kind: "image" | "json" | "other";
  path: string;
  width?: number;
  height?: number;
};

export type WorldMapTrackingPlayer = {
  name: string;
  uuid?: string;
  x: number;
  y: number;
  z: number;
  role?: string;
};

export type WorldMapLivePlayer = WorldMapTrackingPlayer & {
  chunkX: number;
  chunkZ: number;
  lastSeenAt: string;
};

export type WorldMapVisitedChunk = {
  id: string;
  chunkX: number;
  chunkZ: number;
  x?: number;
  z?: number;
  player?: string;
  lastSeenAt: string;
};

export type WorldMapTelemetry = {
  player: WorldMapLivePlayer;
  visitedChunks: WorldMapVisitedChunk[];
  lastSeenAt: string;
};

export type WorldMapTrackingData = {
  available: boolean;
  status?: string;
  generatedAt?: string;
  source?: string;
  publicBaseUrl?: string;
  manifestPath?: string;
  note?: string;
  method?: string;
  focus?: { name: string; x: number; z: number; radiusBlocks?: number };
  bounds?: { minX: number; minZ: number; maxX: number; maxZ: number };
  players?: WorldMapTrackingPlayer[];
  livePlayers?: WorldMapLivePlayer[];
  visitedChunks?: WorldMapVisitedChunk[];
  liveTelemetryAt?: string;
  artifacts?: WorldMapTrackingArtifact[];
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
  tracking?: WorldMapTrackingData;
  mapMemory: {
    mode: "server-stored-shared-memory";
    storage: string;
    clientCacheKey: string;
    refreshSeconds: number;
    version: string;
    strategy: string[];
  };
  live: boolean;
  visibility: {
    public: string[];
    signedIn: string[];
    restricted: string[];
  };
  error?: string;
};

export const WORLD_MAP_CLIENT_CACHE_KEY = "gizmocraft:last-world-map:v2";
export const WORLD_MAP_REFRESH_SECONDS = 15;

export const GIZMOCRAFT_WORLD_SYNC_MODPACK = {
  label: "Download World Sync + Bliss Shader Pack",
  href: "/downloads/gizmocraft-world-sync-modpack.zip",
  fileName: "gizmocraft-world-sync-modpack.zip",
  version: "0.2.1",
  jarName: "gizmocraft-world-sync-client-0.2.0.jar",
  shaderPackName: "Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip",
  status: "Live position heartbeat + Bliss Shaders v2.1.2. Put the client jar in mods and the Bliss zip in shaderpacks.",
  summary: "Downloads the GizmoCraft Fabric client mod plus Bliss Shaders v2.1.2 for the GizmoCraft visual setup.",
} as const;

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizePlayerName(value: unknown) {
  const name = String(value ?? "").trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(name) ? name : "unknown";
}

function chunkFromBlock(value: number) {
  return Math.floor(value / 16);
}

export function normalizeWorldMapTelemetry(input: unknown, nowIso = new Date().toISOString()): WorldMapTelemetry {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const playerRaw = raw.player && typeof raw.player === "object" ? raw.player as Record<string, unknown> : raw;
  const x = finiteNumber(playerRaw.x) ?? 0;
  const y = finiteNumber(playerRaw.y) ?? 0;
  const z = finiteNumber(playerRaw.z) ?? 0;
  const chunkX = finiteNumber(playerRaw.chunkX) ?? chunkFromBlock(x);
  const chunkZ = finiteNumber(playerRaw.chunkZ) ?? chunkFromBlock(z);
  const player: WorldMapLivePlayer = {
    name: sanitizePlayerName(playerRaw.name),
    uuid: typeof playerRaw.uuid === "string" && playerRaw.uuid.trim() ? playerRaw.uuid.trim() : undefined,
    x,
    y,
    z,
    chunkX,
    chunkZ,
    lastSeenAt: nowIso,
  };
  const visitedSource = Array.isArray(raw.visited) ? raw.visited : Array.isArray(raw.visitedChunks) ? raw.visitedChunks : [];
  const visitedChunks = visitedSource.flatMap((entry) => {
    const chunkRaw = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const cx = finiteNumber(chunkRaw.chunkX) ?? finiteNumber(chunkRaw.x);
    const cz = finiteNumber(chunkRaw.chunkZ) ?? finiteNumber(chunkRaw.z);
    if (cx === null || cz === null) return [];
    const chunkXValue = Math.trunc(cx);
    const chunkZValue = Math.trunc(cz);
    return [{
      id: `${chunkXValue}:${chunkZValue}`,
      chunkX: chunkXValue,
      chunkZ: chunkZValue,
      x: finiteNumber(chunkRaw.blockX) ?? undefined,
      z: finiteNumber(chunkRaw.blockZ) ?? undefined,
      player: player.name,
      lastSeenAt: nowIso,
    }];
  });
  if (!visitedChunks.some((chunk) => chunk.id === `${chunkX}:${chunkZ}`)) {
    visitedChunks.unshift({ id: `${chunkX}:${chunkZ}`, chunkX, chunkZ, x, z, player: player.name, lastSeenAt: nowIso });
  }
  return { player, visitedChunks, lastSeenAt: nowIso };
}

export function mergeTrackingTelemetry(tracking: WorldMapTrackingData | undefined, telemetry: WorldMapTelemetry[]): WorldMapTrackingData {
  const newestByPlayer = new Map<string, WorldMapLivePlayer>();
  const chunks = new Map<string, WorldMapVisitedChunk>();
  const sorted = [...telemetry].sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt));
  for (const sample of sorted) {
    newestByPlayer.set(sample.player.name, sample.player);
    for (const chunk of sample.visitedChunks) chunks.set(chunk.id, chunk);
  }
  const livePlayers = [...newestByPlayer.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.name.localeCompare(b.name));
  const visitedChunks = [...chunks.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.id.localeCompare(b.id)).slice(0, 2000);
  return {
    ...(tracking ?? { available: false }),
    available: tracking?.available ?? true,
    status: livePlayers.length ? "live-client-telemetry" : tracking?.status,
    livePlayers,
    visitedChunks,
    liveTelemetryAt: telemetry.at(-1)?.lastSeenAt ?? tracking?.liveTelemetryAt,
  };
}

export function worldMapVersion(data: Pick<WorldMapData, "world" | "regions" | "tracking">) {
  const coverageGeneratedAt = data.tracking?.generatedAt ?? "no-tracking";
  const raw = [
    data.world.name,
    data.world.dimension,
    data.world.regionCount,
    data.world.discoveredChunks,
    data.world.lastScan,
    coverageGeneratedAt,
    data.regions.length,
  ].join(":");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = Math.imul(31, hash) + raw.charCodeAt(index) | 0;
  }
  return `wm-${Math.abs(hash).toString(36)}`;
}

export function mapMemoryMetadata(data: Pick<WorldMapData, "world" | "regions" | "tracking">): WorldMapData["mapMemory"] {
  return {
    mode: "server-stored-shared-memory",
    storage: "gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/coverage.json",
    clientCacheKey: WORLD_MAP_CLIENT_CACHE_KEY,
    refreshSeconds: WORLD_MAP_REFRESH_SECONDS,
    version: worldMapVersion(data),
    strategy: [
      "Minecraft server writes discovered coverage into a shared JSON artifact once, not per viewer.",
      "Dashboard API reads that stored world memory and can be edge/browser cached briefly instead of rescanning world files for every user.",
      "Each browser keeps the last successful map in localStorage so reloads show the known world immediately, then refresh in the background.",
      "Future terrain PNG/vector tiles should use immutable hashed URLs so already-loaded map tiles are reused across visits.",
    ],
  };
}

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
    tracking: {
      available: false,
      status: "bridge-unavailable",
      note: "Live/player-survey map artifacts are generated by the Minecraft tracking backend.",
    },
    mapMemory: {
      mode: "server-stored-shared-memory",
      storage: "gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/coverage.json",
      clientCacheKey: WORLD_MAP_CLIENT_CACHE_KEY,
      refreshSeconds: WORLD_MAP_REFRESH_SECONDS,
      version: "offline-empty",
      strategy: [
        "Keep the last successful browser cache visible when the bridge is offline.",
        "Do not invent undiscovered terrain; empty means no live shared-memory artifact was reachable.",
      ],
    },
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
    const normalized: WorldMapData = {
      ...data,
      world: {
        ...data.world,
        lastScan: data.world?.lastScan ? formatZagrebDateTime(data.world.lastScan) : "live bridge",
      },
      live: true,
    };
    return {
      ...normalized,
      mapMemory: data.mapMemory ?? mapMemoryMetadata(normalized),
    };
  } catch (error) {
    return emptyWorldMapData(error);
  }
}
