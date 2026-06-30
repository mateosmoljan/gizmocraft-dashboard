"use client";

import { useEffect, useRef, useState } from "react";
import { boards as boardDefinitions } from "@/lib/sample-data";
import type { DashboardData, DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";
import { formatPlaytimeHours } from "@/lib/playtime";
import { DashboardProfileSummary } from "@/components/dashboard-profile-summary";
import { DataExplainButton } from "@/components/data-explain-button";

function format(value: number) { return new Intl.NumberFormat("en").format(value); }

type DashboardView = "overview" | "players" | "boards";
const LIVE_REFRESH_MS = 30_000;

function formatRelativeRefresh(lastFetchedAt: number | null, now: number) {
  if (!lastFetchedAt) return "not fetched this session yet";
  const seconds = Math.max(0, Math.round((now - lastFetchedAt) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s ago` : `${minutes}m ago`;
}

function formatBoardValue(value: number, suffix: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${format(rounded)} ${suffix}`;
}

const statExplanations: Record<string, string> = {
  Online: "Current Minecraft server player count from the live bridge when it is reachable.",
  "Top score": "Highest current GizmoCraft score among tracked players, based on the dashboard score formula.",
  "Last database sync": "When the laptop bridge last loaded fresh Minecraft world/player data into the dashboard database.",
  "Website fetch": "How long ago this browser sent a no-cache request to the dashboard API.",
  Score: "Combined activity score used to rank players across mining, mobs, travel, crafting, and survival stats.",
  Diamonds: "Diamond ore mined by this player from Minecraft stats.",
  "Mobs killed": "Total hostile/passive mobs killed by this player from Minecraft stats.",
  "Total playtime": "Total time this player has spent in the world, converted from Minecraft play ticks.",
  Playtime: "Total time this player has spent in the world, converted from Minecraft play ticks.",
  Deaths: "Number of times this player has died in the world.",
  Mined: "Total blocks mined by this player across tracked Minecraft stats.",
  Mobs: "Total mobs killed by this player from Minecraft stats.",
  Distance: "Approximate distance traveled by this player, converted from Minecraft centimeters to kilometers.",
  Placed: "Total blocks placed by this player.",
  Crafted: "Total items crafted by this player.",
  Food: "Total food items eaten by this player.",
  "Damage taken": "Total damage this player has taken, as reported by Minecraft stats.",
  Loading: "This data slot is waiting for the next dashboard refresh.",
};

function explainStat(label: string) {
  return statExplanations[label] ?? `Explanation for ${label}.`;
}

function boardExplanation(title: string, metric: string) {
  return `${title} ranks tracked players by ${metric}. The podium updates from live bridge data when available.`;
}

export function MinecraftDashboard({ view = "overview" }: { view?: DashboardView }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const refreshInFlight = useRef(false);

  async function refresh(syncBridge = true) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const res = await fetch(`/api/dashboard?ts=${Date.now()}${syncBridge ? "&refresh=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard data failed: ${res.status}`);
      const nextData = await res.json();
      setData(nextData);
      const fetchedAt = Date.now();
      setLastFetchedAt(fetchedAt);
      setNow(fetchedAt);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      refreshInFlight.current = false;
    }
  }

  useEffect(() => {
    async function refreshVisibleDashboard(syncBridge = true) {
      if (document.visibilityState !== "visible") return;
      await refresh(syncBridge);
    }

    void refreshVisibleDashboard(true);
    const interval = window.setInterval(() => void refreshVisibleDashboard(true), LIVE_REFRESH_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 5_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshVisibleDashboard(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const loading = data === null;
  const currentPlayers = data?.players ?? [];
  const currentWorldStats = data?.worldStats ?? null;
  const currentBoards = data?.boards ?? boardDefinitions;

  return (
    <div className="space-y-6">
      <Hero worldStats={currentWorldStats} live={Boolean(data?.live)} view={view} loading={loading} failed={failed} lastFetchedLabel={formatRelativeRefresh(lastFetchedAt, now)} />
      {view === "overview" ? <DashboardProfileSummary /> : null}
      {view === "overview" ? <OverviewSection players={currentPlayers} worldStats={currentWorldStats} live={Boolean(data?.live)} loading={loading} lastFetchedLabel={formatRelativeRefresh(lastFetchedAt, now)} /> : null}
      {view === "players" ? <PlayersSection players={currentPlayers} live={Boolean(data?.live)} loading={loading} /> : null}
      {view === "boards" ? <BoardsSection players={currentPlayers} boards={currentBoards} loading={loading} /> : null}
    </div>
  );
}

function DataSkeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-emerald-200/15 ${className}`} aria-label="Loading data" />;
}

function Hero({ worldStats, live, view, loading, failed, lastFetchedLabel }: { worldStats: DashboardWorld | null; live: boolean; view: DashboardView; loading: boolean; failed: boolean; lastFetchedLabel: string }) {
  const titles = {
    overview: ["Minecraft Overview", "The clean world snapshot: online state, top score, last sync, and quick links."],
    players: ["Player cards", "One page for tracked players, profiles, and the stats Mateo will roast later."],
    boards: ["Rivalry boards", "Public leaderboards, shame boards, and podiums for everyone to compare."],
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
        <p className="text-sm text-lime-200">{loading ? failed ? "Waiting for database" : "Fetching database" : live ? "Live bridge data" : "Database pending"}</p>
        {loading || !worldStats ? <DataSkeleton className="ml-auto mt-2 h-7 w-36" /> : <p className="text-xl font-bold">{worldStats.name}</p>}
        {loading || !worldStats ? <DataSkeleton className="ml-auto mt-2 h-4 w-44" /> : <p className="text-sm text-slate-300">{worldStats.difficulty} · {worldStats.trackedPlayers} players tracked</p>}
        <p className="mt-2 text-xs text-lime-100/80">Auto-refreshes every 30s while open · fetched {lastFetchedLabel}</p>
      </div>
    </header>
  );
}

function OverviewSection({ players, worldStats, live, loading, lastFetchedLabel }: { players: DashboardPlayer[]; worldStats: DashboardWorld | null; live: boolean; loading: boolean; lastFetchedLabel: string }) {
  const top = players[0] ?? null;
  const statCards = [
    ["Online", !loading && worldStats ? live ? `${worldStats.playersOnline}/${worldStats.maxPlayers}` : "Live unavailable" : null, explainStat("Online")],
    ["Top score", top ? format(top.score) : null, explainStat("Top score")],
    ["Last database sync", !loading && worldStats ? worldStats.lastSync : null, "When the laptop bridge last loaded fresh Minecraft world/player data into the dashboard database."],
    ["Website fetch", loading ? null : lastFetchedLabel, "How long ago this browser sent a no-cache request to the dashboard API."],
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(([k, v, explanation]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-400">{k}</p><DataExplainButton label={k} explanation={explanation} /></div>
            {loading ? <DataSkeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 text-2xl font-black text-white">{v ?? "No data"}</p>}
          </div>
        ))}
      </div>
      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Current king</p>
          {loading ? <DataSkeleton className="mt-3 h-12 w-60" /> : top ? <h2 className="mt-2 text-4xl font-black">{top.avatar} {top.name}</h2> : <h2 className="mt-2 text-2xl font-black text-slate-300">No player data loaded yet</h2>}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Score" value={!loading && top ? format(top.score) : null} loading={loading} explanation={explainStat("Score")} />
            <Stat label="Diamonds" value={!loading && top ? String(top.diamonds) : null} loading={loading} />
            <Stat label="Mobs killed" value={!loading && top ? format(top.mobsKilled) : null} loading={loading} />
            <Stat label="Total playtime" value={!loading && top ? formatPlaytimeHours(top.playHours) : null} loading={loading} />
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-200/70">Quick jump</p>
          <div className="mt-4 space-y-3">
            <a className="block rounded-2xl bg-emerald-300/10 px-4 py-3 font-bold text-emerald-100" href="/players">Open player cards →</a>
            <a className="block rounded-2xl bg-rose-300/10 px-4 py-3 font-bold text-rose-100" href="/leaderboards">Open shame boards →</a>
          </div>
        </article>
      </section>
    </>
  );
}

function PlayersSection({ players, live, loading }: { players: DashboardPlayer[]; live: boolean; loading: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Player profiles</h2><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{loading ? "Fetching database" : live ? "Live bridge data · auto-refreshing" : "Database pending"}</span></div>
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? [0, 1, 2].map((index) => <PlayerCardSkeleton key={index} />) : players.length ? players.map((p, index) => <PlayerCard key={p.uuid} player={p} rank={index + 1} />) : <p className="text-sm text-slate-300">No player data loaded yet.</p>}
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
        {Array.from({ length: 10 }).map((_, index) => <Stat key={index} label="Loading" value={null} loading />)}
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

function BoardsSection({ players, boards, loading }: { players: DashboardPlayer[]; boards: typeof boardDefinitions; loading: boolean }) {
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-emerald-200">{b.title} · {b.metric}</p>
                <DataExplainButton label={b.title} explanation={boardExplanation(b.title, b.metric)} />
              </div>
              {loading ? <DataSkeleton className="mt-2 h-7 w-36" /> : winner ? <p className="mt-1 text-xl font-black">{winner.name}</p> : <p className="mt-1 text-sm font-bold text-slate-300">No player data loaded yet</p>}
              {loading ? <DataSkeleton className="mt-2 h-4 w-56" /> : winner ? <p className="text-sm text-slate-300">{formatBoardValue(Number(winner[b.field]), b.suffix)} · {"roast" in b ? b.roast : "top tracked player"}</p> : <p className="text-sm text-slate-400">Waiting for live bridge data.</p>}
              <div className="mt-3 space-y-2">
                {loading ? [0, 1, 2].map((index) => (
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

function Stat({ label, value, loading = false, explanation = explainStat(label) }: { label: string; value: string | null; loading?: boolean; explanation?: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3"><p className="text-slate-400">{label}</p><DataExplainButton label={label} explanation={explanation} /></div>
      {loading ? <DataSkeleton className="mt-2 h-5 w-20" /> : <p className="mt-1 font-bold text-white">{value ?? "No data"}</p>}
    </div>
  );
}
