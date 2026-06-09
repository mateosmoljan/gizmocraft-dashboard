"use client";

import { useEffect, useState } from "react";
import type { ServerUsageData, ServerUsageMetric } from "@/lib/server-usage";
import { formatZagrebTime } from "@/lib/time";
import { readClientCache, writeClientCache } from "@/lib/client-cache";

const USAGE_CACHE_KEY = "gizmocraft:last-usage-data";

export function UsageDashboard({ initialUsage }: { initialUsage: ServerUsageData }) {
  const [usage, setUsage] = useState(initialUsage);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (initialUsage.live) {
      setUsage(initialUsage);
      writeClientCache(USAGE_CACHE_KEY, initialUsage);
      return;
    }
    const cached = readClientCache<ServerUsageData>(USAGE_CACHE_KEY);
    if (cached) setUsage({ ...cached, live: false, note: initialUsage.note ?? "Showing last loaded usage data while live telemetry refreshes." });
    else if (initialUsage.metrics.length) writeClientCache(USAGE_CACHE_KEY, initialUsage);
  }, [initialUsage]);

  async function refreshUsage() {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/usage?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`refresh returned ${res.status}`);
      const nextUsage = await res.json();
      setUsage(nextUsage);
      writeClientCache(USAGE_CACHE_KEY, nextUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

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
              <p className={usage.live ? "text-sm text-lime-200" : "text-sm text-amber-200"}>{refreshing ? "Refreshing data" : usage.live ? "Live" : "Showing last loaded data"}</p>
              {refreshing ? <UsageSkeleton className="ml-auto mt-2 h-4 w-36" /> : <p className="mt-1 text-xs text-slate-300">Checked {formatZagrebTime(usage.checkedAt)}</p>}
            </div>
            <button
              type="button"
              onClick={refreshUsage}
              disabled={refreshing}
              className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
            >
              {refreshing ? "Refreshing…" : "Refresh usage data"}
            </button>
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
        {usage.metrics.map((entry) => <UsageCard key={entry.label} metric={entry} refreshing={refreshing} />)}
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

function UsageCard({ metric, refreshing }: { metric: ServerUsageMetric; refreshing: boolean }) {
  const percent = metric.percent ?? null;
  return (
    <article className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{metric.label}</p>
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
