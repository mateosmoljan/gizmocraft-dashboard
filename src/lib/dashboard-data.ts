import { boards, players as fallbackPlayers, worldStats as fallbackWorldStats } from "./sample-data";
import { formatZagrebDateTime } from "@/lib/time";

export type DashboardPlayer = typeof fallbackPlayers[number];
export type DashboardWorld = typeof fallbackWorldStats;

export function bridgeRequestInit(): RequestInit {
  const token = process.env.MINECRAFT_BRIDGE_TOKEN;
  return {
    cache: "no-store",
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  };
}

async function syncBridgeStats(bridgeUrl: string) {
  await fetch(`${bridgeUrl}/api/sync`, {
    ...bridgeRequestInit(),
    method: "POST",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
}

export async function getDashboardData() {
  const bridgeUrl = process.env.MINECRAFT_BRIDGE_URL || "http://gizmo-server:3020";
  try {
    await syncBridgeStats(bridgeUrl);
    const res = await fetch(`${bridgeUrl}/api/leaderboards`, bridgeRequestInit());
    if (!res.ok) throw new Error(`bridge ${res.status}`);
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
  } catch {
    return { players: fallbackPlayers, worldStats: fallbackWorldStats, boards, live: false };
  }
}
