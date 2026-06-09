import { boards, players as fallbackPlayers, worldStats as fallbackWorldStats } from "./sample-data";
import { formatZagrebDateTime } from "@/lib/time";

export type DashboardPlayer = typeof fallbackPlayers[number];
export type DashboardWorld = typeof fallbackWorldStats;
export type DashboardData = {
  players: DashboardPlayer[];
  worldStats: DashboardWorld;
  boards: typeof boards;
  live: boolean;
  error?: string;
};

function bridgeUrlFromEnv() {
  return process.env.MINECRAFT_BRIDGE_URL?.trim() || "http://gizmo-server:3020";
}

function isProductionBridgeConfigured() {
  return Boolean(process.env.MINECRAFT_BRIDGE_URL?.trim());
}

export function bridgeRequestInit(): RequestInit {
  const token = process.env.MINECRAFT_BRIDGE_TOKEN;
  return {
    cache: "no-store",
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  };
}

const BRIDGE_SYNC_TIMEOUT_MS = 30_000;

async function syncBridgeStats(bridgeUrl: string) {
  const res = await fetch(`${bridgeUrl}/api/sync`, {
    ...bridgeRequestInit(),
    method: "POST",
    signal: AbortSignal.timeout(BRIDGE_SYNC_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bridge sync ${res.status}`);
}

function offlineData(error: unknown, allowSampleFallback: boolean): DashboardData {
  if (allowSampleFallback) {
    return { players: fallbackPlayers, worldStats: fallbackWorldStats, boards, live: false, error: String(error instanceof Error ? error.message : error) };
  }

  return {
    players: [],
    worldStats: {
      ...fallbackWorldStats,
      playersOnline: 0,
      trackedPlayers: 0,
      uptime: "bridge unavailable",
      lastSync: "live bridge unavailable",
    },
    boards,
    live: false,
    error: String(error instanceof Error ? error.message : error),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const bridgeUrl = bridgeUrlFromEnv();
  const allowSampleFallback = !isProductionBridgeConfigured();
  try {
    await syncBridgeStats(bridgeUrl);
    const res = await fetch(`${bridgeUrl}/api/leaderboards`, bridgeRequestInit());
    if (!res.ok) throw new Error(`bridge leaderboards ${res.status}`);
    const data = await res.json();
    const players = (data.players ?? []).map((p: any, index: number) => ({
      uuid: p.uuid,
      name: p.name,
      avatar: index === 0 ? "🐓" : index === 1 ? "⚡" : "🧱",
      score: Math.round((p.diamonds ?? 0) * 100 + (p.mobsKilled ?? 0) * 10 + (p.blocksMined ?? 0) / 5 - (p.deaths ?? 0) * 75),
      deaths: p.deaths ?? 0,
      distanceKm: p.distanceKm ?? 0,
      playHours: p.playHours ?? 0,
      mobsKilled: p.mobsKilled ?? 0,
      blocksMined: p.blocksMined ?? 0,
      diamonds: p.diamonds ?? 0,
      foodEaten: p.foodEaten ?? 0,
      blocksPlaced: p.blocksPlaced ?? 0,
      itemsCrafted: p.itemsCrafted ?? 0,
      damageDealt: p.damageDealt ?? 0,
      damageTaken: p.damageTaken ?? 0,
      lastSeen: p.lastSeen ? formatZagrebDateTime(p.lastSeen) : "tracked",
    }));
    if (!players.length && isProductionBridgeConfigured()) throw new Error("bridge returned no players");
    return {
      players: players.length ? players : fallbackPlayers,
      worldStats: {
        name: data.world?.name ?? fallbackWorldStats.name,
        difficulty: data.world?.difficulty ?? fallbackWorldStats.difficulty,
        playersOnline: data.world?.playersOnline ?? 0,
        maxPlayers: data.world?.maxPlayers ?? fallbackWorldStats.maxPlayers,
        trackedPlayers: players.length || data.world?.trackedPlayers || 0,
        uptime: data.world?.uptime ?? "live bridge",
        lastSync: data.world?.lastSync ? formatZagrebDateTime(data.world.lastSync) : "live bridge",
      },
      boards,
      live: true,
    };
  } catch (error) {
    return offlineData(error, allowSampleFallback);
  }
}
