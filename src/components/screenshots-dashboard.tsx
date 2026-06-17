"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, Maximize2, RefreshCw, Radio, UploadCloud, X } from "lucide-react";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
import type { ScreenshotFeed, PlayerScreenshot } from "@/lib/screenshots";
import { formatZagrebTime } from "@/lib/time";

const CACHE_KEY = "gizmocraft:last-screenshot-feed";
const POLL_MS = 5_000;
const INITIAL_VISIBLE_SCREENSHOTS = 3;
const LOAD_MORE_SCREENSHOTS = 3;

function imageUrl(image: PlayerScreenshot) {
  return `/api/screenshots/${encodeURIComponent(image.id)}?v=${encodeURIComponent(image.modifiedAt)}`;
}

function imageDimensions(image: PlayerScreenshot) {
  return {
    width: image.width && image.width > 0 ? image.width : 1920,
    height: image.height && image.height > 0 ? image.height : 1080,
  };
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
  const [uploadPlayer, setUploadPlayer] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SCREENSHOTS);
  const [selectedShot, setSelectedShot] = useState<PlayerScreenshot | null>(null);

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

  useEffect(() => {
    setVisibleCount((current) => Math.min(Math.max(current, INITIAL_VISIBLE_SCREENSHOTS), Math.max(feed.screenshots.length - 1, INITIAL_VISIBLE_SCREENSHOTS)));
  }, [feed.screenshots.length]);

  useEffect(() => {
    if (!selectedShot) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedShot(null);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedShot]);

  const newest = feed.screenshots[0] ?? null;
  const galleryShots = feed.screenshots.slice(1);
  const visibleShots = galleryShots.slice(0, visibleCount);
  const remainingShots = Math.max(galleryShots.length - visibleShots.length, 0);
  const players = useMemo(() => new Set(feed.screenshots.map((shot) => shot.player).filter(Boolean)).size, [feed.screenshots]);
  const helperPlayer = /^[A-Za-z0-9_]{1,16}$/.test(uploadPlayer.trim()) ? uploadPlayer.trim() : "PlayerName";
  const helperUrl = `/api/screenshots/sync-helper?player=${encodeURIComponent(helperPlayer)}`;
  const helperCommand = `powershell -ExecutionPolicy Bypass -File .\\gizmocraft-screenshot-sync-${helperPlayer}.ps1`;

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadStatus(null);
    setError(null);
    const player = uploadPlayer.trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) {
      setUploadStatus("Enter the exact Minecraft player name first.");
      return;
    }
    if (!uploadFile) {
      setUploadStatus("Choose a screenshot image first.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("player", player);
      form.set("screenshot", uploadFile);
      const res = await fetch("/api/screenshots/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `upload returned ${res.status}`);
      setUploadStatus("Uploaded. It will appear in the live gallery now.");
      setUploadFile(null);
      const next = await fetch(`/api/screenshots?ts=${Date.now()}`, { cache: "no-store" });
      if (next.ok) {
        const nextFeed = await next.json();
        setFeed(nextFeed);
        writeClientCache(CACHE_KEY, nextFeed);
      }
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Screenshot upload failed");
    } finally {
      setUploading(false);
    }
  }

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

      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/8 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Add every player</p>
            <h2 className="mt-1 text-2xl font-black text-white">Upload a Minecraft screenshot</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Any player can add their own client screenshots here. Vanilla Minecraft saves screenshots on each player&apos;s computer, so they appear for everyone after upload or client sync.
            </p>
          </div>
        </div>
        <form onSubmit={submitUpload} className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,240px)_1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/80">Player</span>
            <input
              value={uploadPlayer}
              onChange={(event) => setUploadPlayer(event.target.value)}
              placeholder="Minecraft name"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-emerald-200"
              maxLength={16}
              autoComplete="nickname"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/80">Screenshot file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-300 file:px-4 file:py-2 file:text-xs file:font-black file:text-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        {uploadStatus ? <p className="mt-3 text-sm font-bold text-emerald-100">{uploadStatus}</p> : null}
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-sm font-black text-white">Auto-track this player&apos;s future screenshots</p>
          <p className="mt-1 text-xs text-slate-400">
            Type their Minecraft name above, download the helper, then have them run it on their PC while playing. It watches their local <code className="rounded bg-black/30 px-1">.minecraft/screenshots</code> folder and uploads new screenshots automatically.
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <a href={helperUrl} className="inline-flex justify-center rounded-2xl border border-emerald-200/30 bg-emerald-200/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-200/20">
              Download Windows sync helper
            </a>
            <code className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-200">{helperCommand}</code>
          </div>
        </div>
      </section>

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
          <button
            type="button"
            onClick={() => setSelectedShot(newest)}
            className="block w-full rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-cyan-200/80"
            aria-label={`Open latest screenshot by ${newest.player ?? "a player"}`}
          >
            <OptimizedScreenshot
              shot={newest}
              alt={`Latest Minecraft screenshot by ${newest.player ?? "a player"}`}
              className="max-h-[70vh] w-full rounded-2xl border border-white/10 object-contain shadow-2xl shadow-black/40"
              sizes="(min-width: 1280px) 1180px, (min-width: 768px) 92vw, 100vw"
              priority
            />
          </button>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {feed.screenshots.length ? visibleShots.map((shot) => (
          <article key={shot.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-xl shadow-black/20">
            <button
              type="button"
              onClick={() => setSelectedShot(shot)}
              className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-200/80"
              aria-label={`Open screenshot ${shot.fileName}`}
            >
              <OptimizedScreenshot
                shot={shot}
                alt={`Minecraft screenshot ${shot.fileName}`}
                className="aspect-video w-full bg-slate-900 object-cover transition duration-200 hover:scale-[1.02]"
                sizes="(min-width: 1280px) 31vw, (min-width: 640px) 50vw, 100vw"
              />
            </button>
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

      {remainingShots > 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-sm text-slate-300">
            Showing {visibleShots.length} older screenshots. {remainingShots} more are waiting, but not loaded yet.
          </p>
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + LOAD_MORE_SCREENSHOTS)}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:bg-emerald-100"
          >
            Load {Math.min(LOAD_MORE_SCREENSHOTS, remainingShots)} more screenshots
          </button>
        </div>
      ) : null}

      {selectedShot ? <ScreenshotLightbox shot={selectedShot} onClose={() => setSelectedShot(null)} /> : null}
    </div>
  );
}

function ScreenshotLightbox({ shot, onClose }: { shot: PlayerScreenshot; onClose: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [optimizedLoaded, setOptimizedLoaded] = useState(false);
  const [fullQualityLoaded, setFullQualityLoaded] = useState(false);

  async function enterFullscreen() {
    const target = frameRef.current;
    if (!target || !document.fullscreenEnabled) return;
    try {
      await target.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by browser/user settings. The normal lightbox remains usable.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot preview ${shot.fileName}`}
      onClick={onClose}
    >
      <div ref={frameRef} className="relative max-h-full w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/60 fullscreen:max-h-screen fullscreen:max-w-none fullscreen:rounded-none fullscreen:border-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-200/80">Screenshot preview</p>
            <h2 className="mt-1 truncate text-xl font-black text-white">{shot.player ?? "Unknown player"}</h2>
            <p className="truncate text-xs text-slate-400">{shot.fileName} · {formatBytes(shot.sizeBytes)} · {formatZagrebTime(shot.capturedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-emerald-100 sm:inline-flex">
              {fullQualityLoaded ? "Full quality loaded" : optimizedLoaded ? "Loading full quality…" : "Fast preview"}
            </span>
            <button
              type="button"
              onClick={enterFullscreen}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-200/80"
              aria-label="View screenshot fullscreen"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-200/80"
              aria-label="Close screenshot preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="max-h-[82vh] overflow-auto bg-black/40 p-3 fullscreen:max-h-[calc(100vh-80px)] md:p-5">
          <div className="relative mx-auto max-w-full">
            {optimizedLoaded ? (
              <img
                src={imageUrl(shot)}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 mx-auto max-h-[78vh] w-auto max-w-full rounded-2xl object-contain transition-opacity duration-300 fullscreen:max-h-[calc(100vh-120px)] ${fullQualityLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setFullQualityLoaded(true)}
              />
            ) : null}
          <OptimizedScreenshot
            shot={shot}
            alt={`Full size Minecraft screenshot ${shot.fileName}`}
            className={`mx-auto max-h-[78vh] w-auto max-w-full rounded-2xl object-contain transition-opacity duration-300 fullscreen:max-h-[calc(100vh-120px)] ${fullQualityLoaded ? "opacity-0" : "opacity-100"}`}
            sizes="100vw"
            priority
            quality={80}
            onLoad={() => setOptimizedLoaded(true)}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

function OptimizedScreenshot({
  shot,
  alt,
  className,
  sizes,
  priority = false,
  quality,
  onLoad,
}: {
  shot: PlayerScreenshot;
  alt: string;
  className: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  onLoad?: () => void;
}) {
  const { width, height } = imageDimensions(shot);
  const blurSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0f172a"/><stop offset="0.55" stop-color="#14532d"/><stop offset="1" stop-color="#083344"/></linearGradient></defs><rect width="32" height="18" fill="url(#g)"/><filter id="b"><feGaussianBlur stdDeviation="2"/></filter><g filter="url(#b)" opacity=".72"><circle cx="8" cy="5" r="6" fill="#22c55e"/><circle cx="24" cy="12" r="8" fill="#38bdf8"/><rect x="10" y="9" width="14" height="6" rx="2" fill="#fde68a"/></g></svg>`,
  );

  return (
    <Image
      src={imageUrl(shot)}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality ?? (priority ? 74 : 52)}
      placeholder="blur"
      blurDataURL={`data:image/svg+xml;charset=utf-8,${blurSvg}`}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      className={className}
      onLoad={onLoad}
    />
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
