"use client";

import { useEffect, useState } from "react";
import { boards as fallbackBoards } from "@/lib/sample-data";
import { trackedSignals } from "@/lib/tracking";
import type { DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";

function format(value: number) { return new Intl.NumberFormat("en").format(value); }

type DashboardView = "overview" | "players" | "boards" | "tracking";
type DashboardData = { players: DashboardPlayer[]; worldStats: DashboardWorld; boards: typeof fallbackBoards; live: boolean };

function formatBoardValue(value: number, suffix: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${format(rounded)} ${suffix}`;
}

export function MinecraftDashboard({ view = "overview" }: { view?: DashboardView }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`Dashboard data failed: ${res.status}`);
        const nextData = await res.json();
        if (!cancelled) {
          setData(nextData);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void refresh();
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const loading = !data;
  const currentPlayers = data?.players ?? [];
  const currentWorldStats = data?.worldStats ?? null;
  const currentBoards = data?.boards ?? fallbackBoards;

  return (
    <div className="space-y-6">
      <Hero worldStats={currentWorldStats} live={Boolean(data?.live)} view={view} loading={loading} failed={failed} />
      {view === "overview" ? <OverviewSection players={currentPlayers} worldStats={currentWorldStats} live={Boolean(data?.live)} loading={loading} /> : null}
      {view === "players" ? <PlayersSection players={currentPlayers} live={Boolean(data?.live)} loading={loading} /> : null}
      {view === "boards" ? <BoardsSection players={currentPlayers} boards={currentBoards} loading={loading} /> : null}
      {view === "tracking" ? <TrackingSection /> : null}
    </div>
  );
}

function DataSkeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-emerald-200/15 ${className}`} aria-label="Loading data" />;
}

function Hero({ worldStats, live, view, loading, failed }: { worldStats: DashboardWorld | null; live: boolean; view: DashboardView; loading: boolean; failed: boolean }) {
  const titles = {
    overview: ["Minecraft Overview", "The clean world snapshot: online state, top score, last sync, and quick links."],
    players: ["Player cards", "One page for tracked players, profiles, and the stats Mateo will roast later."],
    boards: ["Rivalry boards", "Public leaderboards, shame boards, and podiums for everyone to compare."],
    tracking: ["Tracking map", "Every world signal this dashboard collects or is ready to collect from Gizmo Ivan."],
  } as const;
  const [title, subtitle] = titles[view];
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft Command</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-6xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">{subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <a className="rounded-full bg-emerald-300 px-4 py-2 text-slate-950" href="/players">Player cards</a>
          <a className="rounded-full border border-emerald-300/30 px-4 py-2 text-emerald-100" href="/leaderboards">Rivalry boards</a>
          <a className="rounded-full border border-emerald-300/30 px-4 py-2 text-emerald-100" href="/profile">Edit profile</a>
        </div>
      </div>
      <div className="min-w-56 rounded-2xl border border-lime-300/30 bg-lime-300/10 px-5 py-4 text-right">
        <p className="text-sm text-lime-200">{loading ? "Loading server data" : live ? "Live bridge data" : failed ? "Server data pending" : "Fallback data"}</p>
        {worldStats ? <p className="text-xl font-bold">{worldStats.name}</p> : <DataSkeleton className="ml-auto mt-2 h-7 w-36" />}
        {worldStats ? <p className="text-sm text-slate-300">{worldStats.difficulty} · {worldStats.trackedPlayers} players tracked</p> : <DataSkeleton className="ml-auto mt-2 h-4 w-44" />}
      </div>
    </header>
  );
}

function OverviewSection({ players, worldStats, live, loading }: { players: DashboardPlayer[]; worldStats: DashboardWorld | null; live: boolean; loading: boolean }) {
  const top = players[0] ?? null;
  const statCards = [
    ["Online", worldStats ? `${worldStats.playersOnline}/${worldStats.maxPlayers}` : null],
    ["Top score", top ? format(top.score) : null],
    ["Last sync", worldStats?.lastSync ?? null],
    ["Mode", loading ? null : live ? "Live · 30s refresh" : "Server data pending"],
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur"><p className="text-sm text-slate-400">{k}</p>{v ? <p className="mt-2 text-2xl font-black text-white">{v}</p> : <DataSkeleton className="mt-3 h-8 w-24" />}</div>
        ))}
      </div>
      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Current king</p>
          {top ? <h2 className="mt-2 text-4xl font-black">{top.avatar} {top.name}</h2> : <DataSkeleton className="mt-3 h-12 w-60" />}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Score" value={top ? format(top.score) : null} />
            <Stat label="Diamonds" value={top ? String(top.diamonds) : null} />
            <Stat label="Mobs killed" value={top ? format(top.mobsKilled) : null} />
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-200/70">Quick jump</p>
          <div className="mt-4 space-y-3">
            <a className="block rounded-2xl bg-emerald-300/10 px-4 py-3 font-bold text-emerald-100" href="/players">Open player cards →</a>
            <a className="block rounded-2xl bg-rose-300/10 px-4 py-3 font-bold text-rose-100" href="/leaderboards">Open shame boards →</a>
            <a className="block rounded-2xl bg-lime-300/10 px-4 py-3 font-bold text-lime-100" href="/tracking">Open tracking map →</a>
          </div>
        </article>
      </section>
    </>
  );
}

function PlayersSection({ players, live, loading }: { players: DashboardPlayer[]; live: boolean; loading: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Player profiles</h2><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{loading ? "Loading server data" : live ? "Live bridge data · auto-refreshing" : "Server data pending"}</span></div>
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? [0, 1, 2].map((index) => <PlayerCardSkeleton key={index} />) : players.map((p, index) => <PlayerCard key={p.uuid} player={p} rank={index + 1} />)}
      </div>
    </section>
  );
}

function PlayerCardSkeleton() {
  return (
    <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/12 to-white/5 p-5">
      <div className="flex items-center justify-between"><DataSkeleton className="h-10 w-10 rounded-2xl" /><DataSkeleton className="h-7 w-12 rounded-full" /></div>
      <DataSkeleton className="mt-4 h-8 w-32" />
      <DataSkeleton className="mt-2 h-4 w-40" />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {Array.from({ length: 10 }).map((_, index) => <Stat key={index} label="Loading" value={null} />)}
      </div>
    </article>
  );
}

function PlayerCard({ player: p, rank }: { player: DashboardPlayer; rank: number }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/12 to-white/5 p-5">
      <div className="flex items-center justify-between"><div className="text-4xl">{p.avatar}</div><span className="rounded-full bg-amber-300/20 px-3 py-1 text-sm text-amber-100">#{rank}</span></div>
      <h3 className="mt-4 text-2xl font-black">{p.name}</h3>
      <p className="text-sm text-slate-400">Last seen: {p.lastSeen}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Score" value={format(p.score)} />
        <Stat label="Deaths" value={String(p.deaths)} />
        <Stat label="Mined" value={format(p.blocksMined)} />
        <Stat label="Diamonds" value={String(p.diamonds)} />
        <Stat label="Mobs" value={format(p.mobsKilled)} />
        <Stat label="Distance" value={`${p.distanceKm}km`} />
        <Stat label="Placed" value={format(p.blocksPlaced)} />
        <Stat label="Crafted" value={format(p.itemsCrafted)} />
        <Stat label="Food" value={format(p.foodEaten)} />
        <Stat label="Damage taken" value={format(p.damageTaken)} />
      </div>
    </article>
  );
}

function BoardsSection({ players, boards, loading }: { players: DashboardPlayer[]; boards: typeof fallbackBoards; loading: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Public shame boards</h2>
          <p className="mt-1 text-sm text-slate-400">Live rivalry cards from the world files, one board page instead of a giant scroll.</p>
        </div>
        <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">{boards.length} boards</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {boards.map((b) => {
          const ascending = "ascending" in b && b.ascending;
          const ranked = [...players].sort((a,bp) => ascending ? Number(a[b.field]) - Number(bp[b.field]) : Number(bp[b.field]) - Number(a[b.field]));
          const winner = ranked[0] ?? null;
          const podium = ranked.slice(0, 3);
          return (
            <div key={b.title} className="rounded-2xl border border-emerald-300/10 bg-emerald-300/8 p-4">
              <p className="text-sm text-emerald-200">{b.title} · {b.metric}</p>
              {winner ? <p className="mt-1 text-xl font-black">{winner.name}</p> : <DataSkeleton className="mt-2 h-7 w-36" />}
              {winner ? <p className="text-sm text-slate-300">{formatBoardValue(Number(winner[b.field]), b.suffix)} · {"roast" in b ? b.roast : "top tracked player"}</p> : <DataSkeleton className="mt-2 h-4 w-56" />}
              <div className="mt-3 space-y-2">
                {loading ? [0, 1, 2].map((index) => (
                  <div key={`${b.title}-loading-${index}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <DataSkeleton className="h-4 w-24" />
                    <DataSkeleton className="h-4 w-16" />
                  </div>
                )) : podium.map((p, index) => (
                  <div key={`${b.title}-${p.uuid}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <span className="font-bold text-slate-100">#{index + 1} {p.name}</span>
                    <span className="text-slate-300">{formatBoardValue(Number(p[b.field]), b.suffix)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrackingSection() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <h2 className="text-2xl font-black">Tracking roadmap: everything worth tracking</h2>
      <p className="mt-2 text-sm text-slate-300">These are split out so the dashboard overview stays clean while the collector roadmap remains visible.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {trackedSignals.map((signal) => <div key={signal} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">{signal}</div>)}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) { return <div className="rounded-xl bg-black/25 p-3"><p className="text-slate-400">{label}</p>{value ? <p className="font-bold text-white">{value}</p> : <DataSkeleton className="mt-2 h-5 w-20" />}</div>; }
