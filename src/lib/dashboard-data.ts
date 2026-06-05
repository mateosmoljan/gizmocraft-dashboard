import { boards, players as fallbackPlayers, worldStats as fallbackWorldStats } from "./sample-data";

export type DashboardPlayer = typeof fallbackPlayers[number];
export type DashboardWorld = typeof fallbackWorldStats;

export async function getDashboardData() {
  const bridgeUrl = process.env.MINECRAFT_BRIDGE_URL ?? "http://gizmo-server:3020";
  try {
    const res = await fetch(`${bridgeUrl}/api/leaderboards`, { next: { revalidate: 60 } });
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
      lastSeen: p.lastSeen ? new Date(p.lastSeen).toLocaleString() : "tracked",
    }));
    return {
      players: players.length ? players : fallbackPlayers,
      worldStats: {
        ...fallbackWorldStats,
        ...(data.world ?? {}),
        trackedPlayers: players.length || fallbackWorldStats.trackedPlayers,
        lastSync: data.world?.lastSync ? new Date(data.world.lastSync).toLocaleString() : fallbackWorldStats.lastSync,
      },
      boards,
      live: true,
    };
  } catch {
    return { players: fallbackPlayers, worldStats: fallbackWorldStats, boards, live: false };
  }
}
