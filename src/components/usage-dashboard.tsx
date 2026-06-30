"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ServerUsageData, ServerUsageMetric } from "@/lib/server-usage";
import type { ChunkSettings } from "@/lib/server-settings";
import { formatZagrebTime } from "@/lib/time";
import { DataExplainButton } from "@/components/data-explain-button";

const LIVE_REFRESH_MS = 30_000;
const USAGE_PLACEHOLDERS: ServerUsageMetric[] = [
  { label: "CPU", value: "" },
  { label: "RAM", value: "" },
  { label: "Minecraft RAM", value: "" },
  { label: "Disk", value: "" },
  { label: "Wi‑Fi", value: "" },
  { label: "Network", value: "" },
  { label: "Active Minecraft players", value: "" },
];

export function UsageDashboard({ initialUsage, initialChunkSettings }: { initialUsage: ServerUsageData; initialChunkSettings: ChunkSettings }) {
  const [usage, setUsage] = useState(initialUsage);
  const [chunkSettings, setChunkSettings] = useState(initialChunkSettings);
  const [viewDistance, setViewDistance] = useState(String(initialChunkSettings.viewDistance ?? ""));
  const [simulationDistance, setSimulationDistance] = useState(String(initialChunkSettings.simulationDistance ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setUsage(initialUsage);
  }, [initialUsage]);

  useEffect(() => {
    setChunkSettings(initialChunkSettings);
    setViewDistance(String(initialChunkSettings.viewDistance ?? ""));
    setSimulationDistance(String(initialChunkSettings.simulationDistance ?? ""));
  }, [initialChunkSettings]);

  async function refreshUsage(showBusy = true) {
    setError(null);
    if (showBusy) setRefreshing(true);
    try {
      const [usageRes, settingsRes] = await Promise.all([
        fetch(`/api/usage?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/server-settings?ts=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (!usageRes.ok) throw new Error(`usage refresh returned ${usageRes.status}`);
      const nextUsage = await usageRes.json();
      setUsage(nextUsage);
      if (settingsRes.ok) {
        const nextSettings = await settingsRes.json();
        setChunkSettings(nextSettings);
        setViewDistance(String(nextSettings.viewDistance ?? ""));
        setSimulationDistance(String(nextSettings.simulationDistance ?? ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "refresh failed");
    } finally {
      if (showBusy) setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshLiveUsage(showBusy = false) {
      if (document.visibilityState !== "visible") return;
      await refreshUsage(showBusy);
      if (!cancelled) setRefreshing(false);
    }

    void refreshLiveUsage(false);
    const interval = window.setInterval(() => void refreshLiveUsage(false), LIVE_REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshLiveUsage(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  async function saveChunkSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage(null);
    setError(null);
    setSavingSettings(true);
    try {
      const payload = {
        viewDistance: Number(viewDistance),
        simulationDistance: Number(simulationDistance),
      };
      const res = await fetch("/api/server-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `settings update returned ${res.status}`);
      setChunkSettings(body);
      setViewDistance(String(body.viewDistance ?? ""));
      setSimulationDistance(String(body.simulationDistance ?? ""));
      setSettingsMessage(body.pendingRestart ? "Saved. Restart the Minecraft server for the new chunk distances to fully apply." : "Saved chunk settings.");
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Could not save chunk settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  const usageLoading = !usage.live && usage.metrics.length === 0;
  const usageMetrics = usage.metrics.length ? usage.metrics : USAGE_PLACEHOLDERS;
  const settingsLoading = !chunkSettings.live && chunkSettings.viewDistance == null && chunkSettings.simulationDistance == null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Diagnostics</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">Server usage</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Use this to separate Minecraft server pressure from Wi‑Fi/client lag while everyone is playing.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <div className={`rounded-2xl border px-5 py-4 text-left md:text-right ${usage.live ? "border-lime-300/30 bg-lime-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
              <p className={usage.live ? "text-sm text-lime-200" : "text-sm text-amber-200"}>{usageLoading ? "Fetching server database" : usage.live ? "Live · auto-refreshing" : "Waiting for live telemetry"}</p>
              {usageLoading ? <UsageSkeleton className="ml-auto mt-2 h-4 w-36" /> : <p className="mt-1 text-xs text-slate-300">Checked {formatZagrebTime(usage.checkedAt)}</p>}
            </div>
          </div>
        </div>
      </section>

      {usage.note || error ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-300/8 p-5 text-amber-100">
          <p className="font-bold">Usage data is not live yet.</p>
          {usage.note ? <p className="mt-2 text-sm text-amber-100/80">{usage.note}</p> : null}
          {error ? <p className="mt-2 text-sm text-amber-100/80">{error}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {usageMetrics.map((entry) => <UsageCard key={entry.label} metric={entry} refreshing={refreshing || usageLoading} />)}
      </section>

      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/8 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">Chunk level</p>
            <h2 className="mt-1 text-2xl font-black text-white">Minecraft chunk distance</h2>
            <p className="mt-2 text-sm text-slate-300">
              Current server.properties values. View distance controls visible/generated chunks around players; simulation distance controls ticking chunks.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${chunkSettings.live ? "bg-lime-300 text-slate-950" : "bg-amber-300 text-slate-950"}`}>
            {settingsLoading ? "fetching settings" : chunkSettings.live ? "live settings" : "settings pending"}
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UsageCard metric={{ label: "View distance", value: String(chunkSettings.viewDistance ?? "—"), detail: chunkSettings.effective?.viewAreaChunksPerPlayer ? `${chunkSettings.effective.viewDiameterChunks} × ${chunkSettings.effective.viewDiameterChunks} = ${chunkSettings.effective.viewAreaChunksPerPlayer} visible chunks/player` : undefined }} refreshing={savingSettings || settingsLoading} />
          <UsageCard metric={{ label: "Simulation distance", value: String(chunkSettings.simulationDistance ?? "—"), detail: chunkSettings.effective?.simulationAreaChunksPerPlayer ? `${chunkSettings.effective.simulationDiameterChunks} × ${chunkSettings.effective.simulationDiameterChunks} = ${chunkSettings.effective.simulationAreaChunksPerPlayer} ticking chunks/player` : undefined }} refreshing={savingSettings || settingsLoading} />
          <UsageCard metric={{ label: "Max players", value: String(chunkSettings.maxPlayers ?? "—"), detail: chunkSettings.serverPort ? `Port ${chunkSettings.serverPort}` : undefined }} refreshing={savingSettings || settingsLoading} />
          <UsageCard metric={{ label: "Apply status", value: chunkSettings.pendingRestart ? "Restart needed" : "Active file value", detail: chunkSettings.note ?? "Changes save to server.properties." }} refreshing={savingSettings || settingsLoading} />
        </div>
        <form onSubmit={saveChunkSettings} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm font-bold text-slate-200">
            View distance
            <input
              type="number"
              min="2"
              max="32"
              step="1"
              value={viewDistance}
              onChange={(event) => setViewDistance(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-200"
            />
          </label>
          <label className="text-sm font-bold text-slate-200">
            Simulation distance
            <input
              type="number"
              min="2"
              max="32"
              step="1"
              value={simulationDistance}
              onChange={(event) => setSimulationDistance(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-200"
            />
          </label>
          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
          >
            {savingSettings ? "Saving…" : "Save chunk level"}
          </button>
        </form>
        {settingsMessage ? <p className="mt-3 text-sm font-bold text-cyan-100">{settingsMessage}</p> : null}
        <p className="mt-3 text-xs text-slate-400">Safe range is 2–32. Higher values load many more chunks and can cause lag. A Minecraft restart/reload may be needed before players feel the new distance.</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
        <h2 className="text-2xl font-black">What to watch while lag happens</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Hint title="Server bottleneck" body="High CPU or Minecraft RAM pressure while TPS/player actions stutter." />
          <Hint title="Network/Wi‑Fi bottleneck" body="Server CPU/RAM look normal, but players rubber-band or ping spikes." />
          <Hint title="Storage bottleneck" body="Disk stays busy during world saves, chunk loads, or backups." />
        </div>
      </section>
    </div>
  );
}

function UsageSkeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-emerald-200/15 ${className}`} aria-label="Refreshing data" />;
}

function explainUsageMetric(metric: ServerUsageMetric) {
  const details: Record<string, string> = {
    CPU: "Server CPU pressure. High sustained CPU can make Minecraft ticks and player actions feel delayed.",
    RAM: "Machine memory usage. High RAM pressure can cause slowdowns or swapping.",
    Disk: "Storage usage and pressure. Watch this during saves, chunk loads, backups, or screenshots.",
    Network: "Network throughput/latency signal from the server bridge. Useful for separating Wi‑Fi lag from server lag.",
    "Active Minecraft players": "Live Minecraft player count from the server status/bridge, not dashboard visitors.",
    "View distance": "How many chunks each player can see around them. Higher values load much more world data.",
    "Simulation distance": "How many chunks keep ticking entities, farms, redstone, and mobs around each player.",
    "Max players": "The server.properties max player limit and port context.",
    "Apply status": "Whether the saved chunk settings are active or need a Minecraft restart/reload.",
  };
  return details[metric.label] ?? metric.detail ?? `${metric.label} telemetry from the live server bridge.`;
}

function UsageCard({ metric, refreshing }: { metric: ServerUsageMetric; refreshing: boolean }) {
  const percent = metric.percent ?? null;
  return (
    <article className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-400">{metric.label}</p>
            <DataExplainButton label={metric.label} explanation={explainUsageMetric(metric)} />
          </div>
          {refreshing ? <UsageSkeleton className="mt-3 h-9 w-28" /> : <p className="mt-2 text-3xl font-black text-white">{metric.value}</p>}
        </div>
        {refreshing ? <UsageSkeleton className="h-7 w-14 rounded-full" /> : percent != null ? <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-sm text-emerald-100">{Math.round(percent)}%</span> : null}
      </div>
      {refreshing ? <UsageSkeleton className="mt-4 h-2 w-full rounded-full" /> : percent != null ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${percent}%` }} /></div> : null}
      {refreshing ? <UsageSkeleton className="mt-3 h-4 w-44" /> : metric.detail ? <p className="mt-3 text-sm text-slate-300">{metric.detail}</p> : null}
    </article>
  );
}

function Hint({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-black text-emerald-100">{title}</p><p className="mt-2 text-sm text-slate-300">{body}</p></div>;
}
