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
const DASHBOARD_DATA_CACHE_MS = 15_000;
let cachedDashboardData: { data: DashboardData; fetchedAt: number; bridgeUrl: string } | null = null;
let inFlightDashboardData: Promise<DashboardData> | null = null;

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

async function readDashboardDataFromBridge({ sync = false }: { sync?: boolean } = {}): Promise<DashboardData> {
  const bridgeUrl = bridgeUrlFromEnv();
  const allowSampleFallback = !isProductionBridgeConfigured();
  try {
    if (sync) await syncBridgeStats(bridgeUrl);
    const res = await fetch(`${bridgeUrl}/api/leaderboards`, bridgeRequestInit());
    if (!res.ok) throw new Error(`bridge leaderboards ${res.status}`);
    const data = await res.json();
    const perHour = (value: number, hours: number) => hours > 0 ? Number((value / hours).toFixed(2)) : 0;
    const players = (data.players ?? []).map((p: any, index: number) => {
      const playHours = p.playHours ?? 0;
      const deaths = p.deaths ?? 0;
      const mobsKilled = p.mobsKilled ?? 0;
      const blocksMined = p.blocksMined ?? 0;
      const diamonds = p.diamonds ?? 0;
      const foodEaten = p.foodEaten ?? 0;
      const blocksPlaced = p.blocksPlaced ?? 0;
      const itemsCrafted = p.itemsCrafted ?? 0;
      const damageDealt = p.damageDealt ?? 0;
      const damageTaken = p.damageTaken ?? 0;
      return {
        uuid: p.uuid,
        name: p.name,
        avatar: index === 0 ? "🐓" : index === 1 ? "⚡" : "🧱",
        score: Math.round(diamonds * 100 + mobsKilled * 10 + blocksMined / 5 - deaths * 75),
        deaths,
        distanceKm: p.distanceKm ?? 0,
        playHours,
        mobsKilled,
        blocksMined,
        diamonds,
        foodEaten,
        blocksPlaced,
        itemsCrafted,
        damageDealt,
        damageTaken,
        diamondsPerHour: perHour(diamonds, playHours),
        blocksMinedPerHour: perHour(blocksMined, playHours),
        blocksPlacedPerHour: perHour(blocksPlaced, playHours),
        itemsCraftedPerHour: perHour(itemsCrafted, playHours),
        mobsKilledPerHour: perHour(mobsKilled, playHours),
        damageDealtPerHour: perHour(damageDealt, playHours),
        deathsPerHour: perHour(deaths, playHours),
        foodEatenPerHour: perHour(foodEaten, playHours),
        lastSeen: p.lastSeen ? formatZagrebDateTime(p.lastSeen) : "tracked",
        online: Boolean(p.online),
      };
    });
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

export async function getDashboardData({ sync = false }: { sync?: boolean } = {}): Promise<DashboardData> {
  const now = Date.now();
  const bridgeUrl = bridgeUrlFromEnv();
  if (!sync && cachedDashboardData?.bridgeUrl === bridgeUrl && now - cachedDashboardData.fetchedAt < DASHBOARD_DATA_CACHE_MS) {
    return cachedDashboardData.data;
  }

  const promise = sync
    ? readDashboardDataFromBridge({ sync: true })
    : (inFlightDashboardData ??= readDashboardDataFromBridge().finally(() => {
      inFlightDashboardData = null;
    }));
  const data = await promise;
  if (data.live) cachedDashboardData = { data, fetchedAt: Date.now(), bridgeUrl };
  return data;
}
