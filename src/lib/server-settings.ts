import { bridgeRequestInit } from "@/lib/dashboard-data";

export type ChunkSettings = {
  live: boolean;
  checkedAt: string;
  viewDistance: number | null;
  simulationDistance: number | null;
  maxPlayers?: number | null;
  serverPort?: number | null;
  propertiesPath?: string;
  effective?: {
    viewDiameterChunks: number | null;
    viewAreaChunksPerPlayer: number | null;
    simulationDiameterChunks: number | null;
    simulationAreaChunksPerPlayer: number | null;
  };
  pendingRestart?: boolean;
  note?: string;
};

export type ChunkSettingsUpdate = {
  viewDistance?: number;
  simulationDistance?: number;
};

const unavailableSettings = (note = "Chunk settings bridge endpoint is unavailable."): ChunkSettings => ({
  live: false,
  checkedAt: new Date().toISOString(),
  viewDistance: null,
  simulationDistance: null,
  pendingRestart: false,
  note,
});

function bridgeUrl() {
  return process.env.MINECRAFT_BRIDGE_URL || "http://gizmo-server:3020";
}

export function chunkDiameter(distance: number | null | undefined) {
  return typeof distance === "number" && Number.isFinite(distance) ? distance * 2 + 1 : null;
}

export function chunkAreaPerPlayer(distance: number | null | undefined) {
  const diameter = chunkDiameter(distance);
  return diameter == null ? null : diameter * diameter;
}

function normalizeSettings(data: any): ChunkSettings {
  const viewDistance = typeof data?.viewDistance === "number" ? data.viewDistance : null;
  const simulationDistance = typeof data?.simulationDistance === "number" ? data.simulationDistance : null;
  return {
    live: Boolean(data?.live ?? true),
    checkedAt: typeof data?.checkedAt === "string" ? data.checkedAt : new Date().toISOString(),
    viewDistance,
    simulationDistance,
    maxPlayers: typeof data?.maxPlayers === "number" ? data.maxPlayers : null,
    serverPort: typeof data?.serverPort === "number" ? data.serverPort : null,
    propertiesPath: typeof data?.propertiesPath === "string" ? data.propertiesPath : undefined,
    pendingRestart: Boolean(data?.pendingRestart),
    note: typeof data?.note === "string" ? data.note : undefined,
    effective: {
      viewDiameterChunks: chunkDiameter(viewDistance),
      viewAreaChunksPerPlayer: chunkAreaPerPlayer(viewDistance),
      simulationDiameterChunks: chunkDiameter(simulationDistance),
      simulationAreaChunksPerPlayer: chunkAreaPerPlayer(simulationDistance),
    },
  };
}

export async function getChunkSettings(): Promise<ChunkSettings> {
  try {
    const res = await fetch(`${bridgeUrl()}/api/server-settings`, {
      ...bridgeRequestInit(),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return unavailableSettings(`Chunk settings endpoint returned ${res.status}.`);
    return normalizeSettings(await res.json());
  } catch (error) {
    return unavailableSettings(error instanceof Error ? error.message : "Chunk settings endpoint unavailable.");
  }
}

export async function updateChunkSettings(update: ChunkSettingsUpdate): Promise<ChunkSettings> {
  const res = await fetch(`${bridgeUrl()}/api/server-settings`, {
    ...bridgeRequestInit(),
    method: "PUT",
    headers: {
      ...(bridgeRequestInit().headers ?? {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(update),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Chunk settings update returned ${res.status}`);
  }
  return normalizeSettings(await res.json());
}
