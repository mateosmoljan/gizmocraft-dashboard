"use client";

import { useEffect, useState } from "react";
import { boards as fallbackBoards, players as fallbackPlayers, worldStats as fallbackWorldStats } from "@/lib/sample-data";
import { trackedSignals } from "@/lib/tracking";
import type { DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
import { formatPlaytimeHours } from "@/lib/playtime";

function format(value: number) { return new Intl.NumberFormat("en").format(value); }

type DashboardView = "overview" | "players" | "boards" | "tracking";
type DashboardData = { players: DashboardPlayer[]; worldStats: DashboardWorld; boards: typeof fallbackBoards; live: boolean };
const DASHBOARD_CACHE_KEY = "gizmocraft:last-dashboard-data";
const initialDashboardData = (): DashboardData => ({ players: fallbackPlayers, worldStats: fallbackWorldStats, boards: fallbackBoards, live: false });

function formatBoardValue(value: number, suffix: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${format(rounded)} ${suffix}`;
}

export function MinecraftDashboard({ view = "overview" }: { view?: DashboardView }) {
  const [data, setData] = useState<DashboardData>(initialDashboardData);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(showSkeleton = false) {
    if (showSkeleton) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard data failed: ${res.status}`);
      const nextData = await res.json();
      setData(nextData);
      writeClientCache(DASHBOARD_CACHE_KEY, nextData);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cached = readClientCache<DashboardData>(DASHBOARD_CACHE_KEY);
    if (cached) setData(cached);
    void refresh(false);
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const currentPlayers = data.players;
  const currentWorldStats = data.worldStats;
  const currentBoards = data.boards;

  return (
    <div className="space-y-6">
      <Hero worldStats={currentWorldStats} live={Boolean(data.live)} view={view} refreshing={refreshing} failed={failed} onRefresh={() => void refresh(true)} />
      {view === "overview" ? <OverviewSection players={currentPlayers} worldStats={currentWorldStats} live={Boolean(data.live)} refreshing={refreshing} /> : null}
      {view === "players" ? <PlayersSection players={currentPlayers} live={Boolean(data.live)} refreshing={refreshing} /> : null}
      {view === "boards" ? <BoardsSection players={currentPlayers} boards={currentBoards} refreshing={refreshing} /> : null}
      {view === "tracking" ? <TrackingSection /> : null}
    </div>
  );
}

function DataSkeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-emerald-200/15 ${className}`} aria-label="Loading data" />;
}

function Hero({ worldStats, live, view, refreshing, failed, onRefresh }: { worldStats: DashboardWorld; live: boolean; view: DashboardView; refreshing: boolean; failed: boolean; onRefresh: () => void }) {
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
        <p className="text-sm text-lime-200">{refreshing ? "Refreshing data" : live ? "Live bridge data" : failed ? "Showing last loaded data" : "Last loaded data"}</p>
        {refreshing ? <DataSkeleton className="ml-auto mt-2 h-7 w-36" /> : <p className="text-xl font-bold">{worldStats.name}</p>}
        {refreshing ? <DataSkeleton className="ml-auto mt-2 h-4 w-44" /> : <p className="text-sm text-slate-300">{worldStats.difficulty} · {worldStats.trackedPlayers} players tracked</p>}
        <button type="button" onClick={onRefresh} disabled={refreshing} className="mt-3 rounded-full bg-lime-300 px-3 py-1.5 text-xs font-black text-slate-950 disabled:cursor-wait disabled:opacity-70">{refreshing ? "Refreshing…" : "Refresh data"}</button>
      </div>
    </header>
  );
}

function OverviewSection({ players, worldStats, live, refreshing }: { players: DashboardPlayer[]; worldStats: DashboardWorld; live: boolean; refreshing: boolean }) {
  const top = players[0] ?? null;
  const statCards = [
    ["Online", `${worldStats.playersOnline}/${worldStats.maxPlayers}`],
    ["Top score", top ? format(top.score) : null],
    ["Last sync", worldStats.lastSync],
    ["Mode", refreshing ? null : live ? "Live · 30s refresh" : "Last loaded data"],
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur"><p className="text-sm text-slate-400">{k}</p>{refreshing ? <DataSkeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 text-2xl font-black text-white">{v ?? "No data"}</p>}</div>
        ))}
      </div>
      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Current king</p>
          {refreshing ? <DataSkeleton className="mt-3 h-12 w-60" /> : top ? <h2 className="mt-2 text-4xl font-black">{top.avatar} {top.name}</h2> : <h2 className="mt-2 text-2xl font-black text-slate-300">No player data loaded yet</h2>}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Score" value={!refreshing && top ? format(top.score) : null} />
            <Stat label="Diamonds" value={!refreshing && top ? String(top.diamonds) : null} />
            <Stat label="Mobs killed" value={!refreshing && top ? format(top.mobsKilled) : null} />
            <Stat label="Total playtime" value={!refreshing && top ? formatPlaytimeHours(top.playHours) : null} />
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

function PlayersSection({ players, live, refreshing }: { players: DashboardPlayer[]; live: boolean; refreshing: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Player profiles</h2><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{refreshing ? "Refreshing data" : live ? "Live bridge data · auto-refreshing" : "Last loaded data"}</span></div>
      <div className="grid gap-4 md:grid-cols-3">
        {refreshing ? [0, 1, 2].map((index) => <PlayerCardSkeleton key={index} />) : players.length ? players.map((p, index) => <PlayerCard key={p.uuid} player={p} rank={index + 1} />) : <p className="text-sm text-slate-300">No player data loaded yet.</p>}
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
      <p className="text-sm text-slate-400">{p.online ? "Online now" : `Last seen: ${p.lastSeen}`}</p>
      <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">Total playtime: {formatPlaytimeHours(p.playHours)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Score" value={format(p.score)} />
        <Stat label="Playtime" value={formatPlaytimeHours(p.playHours)} />
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

function BoardsSection({ players, boards, refreshing }: { players: DashboardPlayer[]; boards: typeof fallbackBoards; refreshing: boolean }) {
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
              {refreshing ? <DataSkeleton className="mt-2 h-7 w-36" /> : winner ? <p className="mt-1 text-xl font-black">{winner.name}</p> : <p className="mt-1 text-sm font-bold text-slate-300">No player data loaded yet</p>}
              {refreshing ? <DataSkeleton className="mt-2 h-4 w-56" /> : winner ? <p className="text-sm text-slate-300">{formatBoardValue(Number(winner[b.field]), b.suffix)} · {"roast" in b ? b.roast : "top tracked player"}</p> : <p className="text-sm text-slate-400">Waiting for live bridge data.</p>}
              <div className="mt-3 space-y-2">
                {refreshing ? [0, 1, 2].map((index) => (
                  <div key={`${b.title}-loading-${index}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <DataSkeleton className="h-4 w-24" />
                    <DataSkeleton className="h-4 w-16" />
                  </div>
                )) : podium.map((p, index) => (
                  <div key={`${b.title}-${p.uuid}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <span className="font-bold text-slate-100">#{index + 1} {p.name}</span>
                    <span className="text-right text-slate-300">{formatBoardValue(Number(p[b.field]), b.suffix)} · {formatPlaytimeHours(p.playHours)} played</span>
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

function Stat({ label, value }: { label: string; value: string | null }) { return <div className="rounded-xl bg-black/25 p-3"><p className="text-slate-400">{label}</p><p className="font-bold text-white">{value ?? "No data"}</p></div>; }
