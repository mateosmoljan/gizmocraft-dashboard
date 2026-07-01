"use client";

import { useEffect, useRef, useState } from "react";
import { boards as boardDefinitions } from "@/lib/sample-data";
import type { DashboardData, DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";
import { formatPlaytimeHours } from "@/lib/playtime";
import { DashboardProfileSummary } from "@/components/dashboard-profile-summary";

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

function formatBoardValue(value: number, suffix: string, field?: keyof DashboardPlayer) {
  if (field === "playHours") return formatPlaytimeHours(value);
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${format(rounded)} ${suffix}`;
}

type BoardDefinition = typeof boardDefinitions[number];

const boardToneClasses: Record<BoardDefinition["tone"], { ring: string; pill: string; glow: string; bar: string }> = {
  emerald: { ring: "border-emerald-300/20 bg-emerald-300/8", pill: "bg-emerald-300/12 text-emerald-100 border-emerald-300/25", glow: "from-emerald-300/18", bar: "bg-emerald-300" },
  cyan: { ring: "border-cyan-300/20 bg-cyan-300/8", pill: "bg-cyan-300/12 text-cyan-100 border-cyan-300/25", glow: "from-cyan-300/18", bar: "bg-cyan-300" },
  violet: { ring: "border-violet-300/20 bg-violet-300/8", pill: "bg-violet-300/12 text-violet-100 border-violet-300/25", glow: "from-violet-300/18", bar: "bg-violet-300" },
  rose: { ring: "border-rose-300/20 bg-rose-300/8", pill: "bg-rose-300/12 text-rose-100 border-rose-300/25", glow: "from-rose-300/18", bar: "bg-rose-300" },
  amber: { ring: "border-amber-300/20 bg-amber-300/8", pill: "bg-amber-300/12 text-amber-100 border-amber-300/25", glow: "from-amber-300/18", bar: "bg-amber-300" },
  sky: { ring: "border-sky-300/20 bg-sky-300/8", pill: "bg-sky-300/12 text-sky-100 border-sky-300/25", glow: "from-sky-300/18", bar: "bg-sky-300" },
};

function rankBoard(players: DashboardPlayer[], board: BoardDefinition) {
  const ascending = "ascending" in board && board.ascending;
  return [...players].sort((a, b) => {
    const diff = Number(a[board.field]) - Number(b[board.field]);
    return ascending ? diff : -diff;
  });
}

export function MinecraftDashboard({ view = "overview" }: { view?: DashboardView }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const refreshInFlight = useRef(false);

  async function refresh(syncBridge = true, showBusy = false) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showBusy) setRetrying(true);
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
      if (showBusy) setRetrying(false);
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
  const showRetry = failed && data === null;

  return (
    <div className="space-y-6">
      {showRetry ? <DataLoadRetry retrying={retrying} onRetry={() => void refresh(true, true)} /> : null}
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

function DataLoadRetry({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <section className="mx-auto flex min-h-56 max-w-xl flex-col items-center justify-center rounded-3xl border border-amber-300/25 bg-amber-300/8 p-8 text-center shadow-2xl shadow-black/20">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-100/80">Database timeout</p>
      <h2 className="mt-2 text-2xl font-black text-white">Data did not load</h2>
      <p className="mt-2 text-sm text-slate-300">The website will keep retrying automatically. You can also retry now.</p>
      <button type="button" onClick={onRetry} disabled={retrying} className="mt-5 rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70">
        {retrying ? "Retrying…" : "Refresh data"}
      </button>
    </section>
  );
}

function OverviewSection({ players, worldStats, live, loading, lastFetchedLabel }: { players: DashboardPlayer[]; worldStats: DashboardWorld | null; live: boolean; loading: boolean; lastFetchedLabel: string }) {
  const top = players[0] ?? null;
  const statCards = [
    ["Online", !loading && worldStats ? live ? `${worldStats.playersOnline}/${worldStats.maxPlayers}` : "Live unavailable" : null],
    ["Top score", top ? format(top.score) : null],
    ["Last database sync", !loading && worldStats ? worldStats.lastSync : null],
    ["Website fetch", loading ? null : lastFetchedLabel],
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur">
            <p className="text-sm text-slate-400">{k}</p>
            {loading ? <DataSkeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 text-2xl font-black text-white">{v ?? "No data"}</p>}
          </div>
        ))}
      </div>
      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Current king</p>
          {loading ? <DataSkeleton className="mt-3 h-12 w-60" /> : top ? <h2 className="mt-2 text-4xl font-black">{top.avatar} {top.name}</h2> : <h2 className="mt-2 text-2xl font-black text-slate-300">No player data loaded yet</h2>}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Score" value={!loading && top ? format(top.score) : null} loading={loading} />
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
  const featuredBoards = boards.slice(0, 3);
  const categories = Array.from(new Set(boards.map((board) => board.category)));

  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200/70">Rivalry center</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Boards that are easy to scan</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">More categories, clearer winners, and top-three rows grouped by mining, building, combat, survival, and activity.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-slate-200">{boards.length} boards</span>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">{players.length || "—"} tracked players</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
        {categories.map((category) => <span key={category} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2">{category}</span>)}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {featuredBoards.map((board, index) => {
          const ranked = rankBoard(players, board);
          const winner = ranked[0] ?? null;
          const tone = boardToneClasses[board.tone];
          return (
            <article key={`featured-${board.title}`} className={`relative overflow-hidden rounded-3xl border ${tone.ring} p-5`}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} to-transparent opacity-80`} />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone.pill}`}>#{index + 1} featured</span>
                </div>
                <p className="mt-4 text-sm font-bold text-slate-300">{board.category} · {board.metric}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{board.title}</h3>
                {loading ? <DataSkeleton className="mt-4 h-10 w-40" /> : winner ? <p className="mt-4 text-3xl font-black text-white">{winner.name}</p> : <p className="mt-4 text-sm font-bold text-slate-300">No player data loaded yet</p>}
                {loading ? <DataSkeleton className="mt-3 h-5 w-52" /> : winner ? <p className="mt-2 text-sm text-slate-300">{formatBoardValue(Number(winner[board.field]), board.suffix, board.field)} · {board.roast}</p> : <p className="mt-2 text-sm text-slate-400">Waiting for live bridge data.</p>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {boards.map((board) => <BoardCard key={board.title} board={board} players={players} loading={loading} />)}
      </div>
    </section>
  );
}

function BoardCard({ board, players, loading }: { board: BoardDefinition; players: DashboardPlayer[]; loading: boolean }) {
  const ranked = rankBoard(players, board);
  const winner = ranked[0] ?? null;
  const podium = ranked.slice(0, 3);
  const tone = boardToneClasses[board.tone];

  return (
    <article className={`overflow-hidden rounded-3xl border ${tone.ring} shadow-lg shadow-black/10`}>
      <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/20 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${tone.pill}`}>{board.category}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300">{board.metric}</span>
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{board.title}</h3>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Current leader</p>
          {loading ? <DataSkeleton className="mt-4 h-9 w-36" /> : winner ? <p className="mt-3 truncate text-3xl font-black text-white">{winner.avatar} {winner.name}</p> : <p className="mt-3 text-sm font-bold text-slate-300">No player data loaded yet</p>}
          {loading ? <DataSkeleton className="mt-3 h-5 w-44" /> : winner ? <p className="mt-2 text-sm font-bold text-slate-300">{formatBoardValue(Number(winner[board.field]), board.suffix, board.field)}</p> : <p className="mt-2 text-sm text-slate-500">Waiting for live bridge data.</p>}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Top 3</p>
          {loading ? [0, 1, 2].map((index) => <BoardRowSkeleton key={index} />) : podium.length ? podium.map((player, index) => (
            <div key={`${board.title}-${player.uuid}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5 text-sm">
              <span className={`grid size-8 place-items-center rounded-full text-xs font-black text-slate-950 ${tone.bar}`}>{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-black text-slate-100">{player.name}</p>
                <p className="truncate text-xs text-slate-500">{formatPlaytimeHours(player.playHours)} played</p>
              </div>
              <p className="text-right font-black text-white">{formatBoardValue(Number(player[board.field]), board.suffix, board.field)}</p>
            </div>
          )) : <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">No rankings yet.</p>}
        </div>
      </div>
    </article>
  );
}

function BoardRowSkeleton() {
  return <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5"><DataSkeleton className="size-8 rounded-full" /><DataSkeleton className="h-5 w-32" /><DataSkeleton className="h-5 w-16" /></div>;
}


function Stat({ label, value, loading = false }: { label: string; value: string | null; loading?: boolean }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <p className="text-slate-400">{label}</p>
      {loading ? <DataSkeleton className="mt-2 h-5 w-20" /> : <p className="mt-1 font-bold text-white">{value ?? "No data"}</p>}
    </div>
  );
}
