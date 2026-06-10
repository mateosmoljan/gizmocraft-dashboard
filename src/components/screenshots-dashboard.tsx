"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, RefreshCw, Radio, UploadCloud } from "lucide-react";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
import type { ScreenshotFeed, PlayerScreenshot } from "@/lib/screenshots";
import { formatZagrebTime } from "@/lib/time";

const CACHE_KEY = "gizmocraft:last-screenshot-feed";
const POLL_MS = 3_000;

function imageUrl(image: PlayerScreenshot) {
  return `/api/screenshots/${encodeURIComponent(image.id)}?v=${encodeURIComponent(image.modifiedAt)}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ScreenshotsDashboard({ initialFeed }: { initialFeed: ScreenshotFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialFeed.error ?? null);

  useEffect(() => {
    if (initialFeed.live) {
      setFeed(initialFeed);
      writeClientCache(CACHE_KEY, initialFeed);
      return;
    }
    const cached = readClientCache<ScreenshotFeed>(CACHE_KEY);
    if (cached) setFeed({ ...cached, live: false, note: initialFeed.note ?? "Showing the last loaded screenshot feed while live refresh reconnects." });
  }, [initialFeed]);

  useEffect(() => {
    let cancelled = false;
    async function refreshFeed() {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/screenshots?ts=${Date.now()}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `screenshots returned ${res.status}`);
        if (!cancelled) {
          setFeed(body);
          setError(null);
          writeClientCache(CACHE_KEY, body);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Screenshot refresh failed");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    void refreshFeed();
    const interval = window.setInterval(() => void refreshFeed(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const newest = feed.screenshots[0] ?? null;
  const players = useMemo(() => new Set(feed.screenshots.map((shot) => shot.player).filter(Boolean)).size, [feed.screenshots]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Live gallery</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">Player screenshots</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Screenshots are scanned every few seconds. When a player upload/sync lands in the bridge inbox, it appears here without rebuilding the website.
            </p>
          </div>
          <div className={`rounded-2xl border px-5 py-4 ${feed.live ? "border-lime-300/30 bg-lime-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
            <div className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${refreshing ? "animate-pulse" : ""}`} />
              <p className={feed.live ? "text-sm font-bold text-lime-100" : "text-sm font-bold text-amber-100"}>{feed.live ? "Live polling" : "Last loaded"}</p>
            </div>
            <p className="mt-1 text-xs text-slate-300">Checked {formatZagrebTime(feed.checkedAt)}</p>
          </div>
        </div>
      </section>

      {error || feed.note ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-300/8 p-5 text-amber-100">
          <p className="font-bold">Screenshot feed status</p>
          {feed.note ? <p className="mt-2 text-sm text-amber-100/80">{feed.note}</p> : null}
          {error ? <p className="mt-2 text-sm text-amber-100/80">{error}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Camera className="h-5 w-5" />} label="Screenshots" value={String(feed.count)} detail="Newest first" />
        <StatCard icon={<UploadCloud className="h-5 w-5" />} label="Players seen" value={String(players)} detail="Parsed from upload/player names" />
        <StatCard icon={<RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />} label="Refresh" value="3 sec" detail="No page reload needed" />
      </section>

      {newest ? (
        <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/8 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">Newest shot</p>
              <h2 className="mt-1 text-2xl font-black text-white">{newest.player ?? "Unknown player"}</h2>
            </div>
            <p className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">{formatZagrebTime(newest.capturedAt)}</p>
          </div>
          <img src={imageUrl(newest)} alt={`Latest Minecraft screenshot by ${newest.player ?? "a player"}`} className="max-h-[70vh] w-full rounded-2xl border border-white/10 object-contain shadow-2xl shadow-black/40" />
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {feed.screenshots.length ? feed.screenshots.map((shot) => (
          <article key={shot.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-xl shadow-black/20">
            <img src={imageUrl(shot)} alt={`Minecraft screenshot ${shot.fileName}`} loading="lazy" className="aspect-video w-full bg-slate-900 object-cover" />
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black text-white">{shot.player ?? "Unknown player"}</h3>
                  <p className="truncate text-xs text-slate-500">{shot.fileName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-slate-300">{formatBytes(shot.sizeBytes)}</span>
              </div>
              <p className="text-sm text-slate-300">Captured {formatZagrebTime(shot.capturedAt)}</p>
            </div>
          </article>
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300 sm:col-span-2 xl:col-span-3">
            <Camera className="mx-auto h-10 w-10 text-emerald-200" />
            <h2 className="mt-3 text-2xl font-black text-white">No screenshots received yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
              The website is ready. A screenshot will show up as soon as a player/client syncs or uploads an image into the server screenshot inbox.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-emerald-200">{icon}<span className="text-sm font-bold uppercase tracking-[0.2em]">{label}</span></div>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </article>
  );
}
