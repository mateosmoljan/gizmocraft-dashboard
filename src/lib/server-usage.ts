import { bridgeRequestInit } from "@/lib/dashboard-data";

export type ServerUsageMetric = {
  label: string;
  value: string;
  detail?: string;
  percent?: number | null;
};

export type ServerUsageData = {
  live: boolean;
  checkedAt: string;
  host?: string;
  minecraft?: {
    status?: string;
    playersOnline?: number;
    maxPlayers?: number;
    onlinePlayers?: string[];
    process?: string;
    uptime?: string;
  };
  metrics: ServerUsageMetric[];
  note?: string;
};

const unavailableUsage = (note = "Server usage bridge endpoint is not installed yet."): ServerUsageData => ({
  live: false,
  checkedAt: new Date().toISOString(),
  metrics: [],
  note,
});

function metric(label: string, value: unknown, detail?: unknown, percent?: unknown): ServerUsageMetric {
  return {
    label,
    value: typeof value === "string" || typeof value === "number" ? String(value) : "Unavailable",
    detail: typeof detail === "string" || typeof detail === "number" ? String(detail) : undefined,
    percent: typeof percent === "number" && Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
  };
}

export async function getServerUsage(): Promise<ServerUsageData> {
  const bridgeUrl = process.env.MINECRAFT_BRIDGE_URL || "http://gizmo-server:3020";
  try {
    const res = await fetch(`${bridgeUrl}/api/usage`, {
      ...bridgeRequestInit(),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return unavailableUsage(`Usage endpoint returned ${res.status}.`);

    const data = await res.json();
    const system = data.system ?? data;
    const minecraft = data.minecraft ?? data.server ?? {};
    const memory = system.memory ?? data.memory ?? {};
    const cpu = system.cpu ?? data.cpu ?? {};
    const disk = system.disk ?? data.disk ?? {};
    const network = system.network ?? data.network ?? {};

    const activePlayers = Array.isArray(minecraft.onlinePlayers) ? minecraft.onlinePlayers.filter((name: unknown) => typeof name === "string") : [];
    const activePlayerCount = typeof minecraft.playersOnline === "number" ? minecraft.playersOnline : activePlayers.length;
    const activePlayerValue = minecraft.maxPlayers != null ? `${activePlayerCount}/${minecraft.maxPlayers} online` : `${activePlayerCount} online`;
    const activePlayerDetail = activePlayers.length ? activePlayers.join(", ") : "No active Minecraft players right now";

    return {
      live: true,
      checkedAt: data.checkedAt ?? new Date().toISOString(),
      host: system.host ?? data.host,
      minecraft: {
        status: minecraft.status,
        playersOnline: activePlayerCount,
        maxPlayers: minecraft.maxPlayers,
        onlinePlayers: activePlayers,
        process: minecraft.process,
        uptime: minecraft.uptime,
      },
      metrics: [
        metric("CPU", cpu.usagePercent ?? cpu.percent, cpu.detail ?? cpu.model, cpu.usagePercent ?? cpu.percent),
        metric("RAM", memory.used ?? memory.usedHuman, memory.total ? `${memory.total} total` : memory.detail, memory.usedPercent ?? memory.percent),
        metric("Minecraft RAM", minecraft.memory?.used ?? minecraft.memoryUsed, minecraft.memory?.limit ? `${minecraft.memory.limit} limit` : minecraft.memoryDetail, minecraft.memory?.percent ?? minecraft.memoryPercent),
        metric("Disk", disk.used ?? disk.usedHuman, disk.total ? `${disk.total} total` : disk.detail, disk.usedPercent ?? disk.percent),
        metric("Server network", network.wifi?.ssid ?? network.ssid ?? network.summary ?? (network.wifi?.connected === false ? "No Wi‑Fi SSID" : "Unavailable"), network.detail ?? network.interface),
        metric("Network", network.summary ?? network.latency ?? "Unavailable", network.detail),
        metric("Active Minecraft players", activePlayerValue, activePlayerDetail),
      ],
    };
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: unknown }).cause : null;
    const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code?: unknown }).code) : null;
    const host = cause && typeof cause === "object" && "host" in cause ? String((cause as { host?: unknown }).host) : null;
    const detail = code && host ? `Vercel cannot reach the bridge at ${host} (${code}).` : error instanceof Error ? error.message : "Usage endpoint unavailable.";
    return unavailableUsage(detail);
  }
}
