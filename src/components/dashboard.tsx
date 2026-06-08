"use client";

import { useEffect, useState } from "react";
import { boards as fallbackBoards, players as fallbackPlayers, worldStats as fallbackWorldStats } from "@/lib/sample-data";
import { trackedSignals } from "@/lib/tracking";
import type { DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";

function format(value: number) { return new Intl.NumberFormat("en").format(value); }

function formatBoardValue(value: number, suffix: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${format(rounded)} ${suffix}`;
}

export function MinecraftDashboard({ players = fallbackPlayers, worldStats = fallbackWorldStats, boards = fallbackBoards, live = false }: { players?: DashboardPlayer[]; worldStats?: DashboardWorld; boards?: typeof fallbackBoards; live?: boolean }) {
  const [data, setData] = useState({ players, worldStats, boards, live });

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) return;
      const nextData = await res.json();
      if (!cancelled) setData(nextData);
    }
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const currentPlayers = data.players?.length ? data.players : fallbackPlayers;
  const currentWorldStats = data.worldStats ?? fallbackWorldStats;
  const currentBoards = data.boards ?? fallbackBoards;
  return (
    <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft Command</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-6xl">Minecraft Dashboard</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-300">Google-login player profiles, public rivalry boards, world telemetry, and every dumb statistic worth making fun of.</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold"><a className="rounded-full bg-emerald-300 px-4 py-2 text-slate-950" href="/profile">Edit profile</a><a className="rounded-full border border-emerald-300/30 px-4 py-2 text-emerald-100" href="/profiles">Public profiles</a></div>
          </div>
          <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 px-5 py-4 text-right">
            <p className="text-sm text-lime-200">World</p>
            <p className="text-xl font-bold">{currentWorldStats.name}</p>
            <p className="text-sm text-slate-300">{currentWorldStats.difficulty} · {currentWorldStats.trackedPlayers} players tracked</p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {[['Online', currentWorldStats.playersOnline + '/' + currentWorldStats.maxPlayers], ['Top score', format(currentPlayers[0].score)], ['Last sync', currentWorldStats.lastSync], ['Mode', 'Auto-refresh 30s']].map(([k,v]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur"><p className="text-sm text-slate-400">{k}</p><p className="mt-2 text-2xl font-black text-white">{v}</p></div>
          ))}
        </div>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Player profiles</h2><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{data.live ? "Live bridge data · auto-refreshing" : "Sample/fallback data"}</span></div>
            <div className="grid gap-4 md:grid-cols-3">
              {currentPlayers.map((p, index) => (
                <article key={p.uuid} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/12 to-white/5 p-5">
                  <div className="flex items-center justify-between"><div className="text-4xl">{p.avatar}</div><span className="rounded-full bg-amber-300/20 px-3 py-1 text-sm text-amber-100">#{index+1}</span></div>
                  <h3 className="mt-4 text-2xl font-black">{p.name}</h3>
                  <p className="text-sm text-slate-400">Last seen: {p.lastSeen}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Score" value={format(p.score)} />
                    <Stat label="Deaths" value={String(p.deaths)} />
                    <Stat label="Mined" value={format(p.blocksMined)} />
                    <Stat label="Diamonds" value={String(p.diamonds)} />
                    <Stat label="Mobs" value={format(p.mobsKilled)} />
                    <Stat label="Distance" value={`${p.distanceKm}km`} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Public shame boards</h2>
                <p className="mt-1 text-sm text-slate-400">Live rivalry cards from the world files.</p>
              </div>
              <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">{currentBoards.length} boards</span>
            </div>
            <div className="mt-4 space-y-4">
              {currentBoards.map((b) => {
                const ascending = "ascending" in b && b.ascending;
                const ranked = [...currentPlayers].sort((a,bp) => ascending ? Number(a[b.field]) - Number(bp[b.field]) : Number(bp[b.field]) - Number(a[b.field]));
                const winner = ranked[0];
                const podium = ranked.slice(0, 3);
                return (
                  <div key={b.title} className="rounded-2xl border border-emerald-300/10 bg-emerald-300/8 p-4">
                    <p className="text-sm text-emerald-200">{b.title} · {b.metric}</p>
                    <p className="mt-1 text-xl font-black">{winner.name}</p>
                    <p className="text-sm text-slate-300">{formatBoardValue(Number(winner[b.field]), b.suffix)} · {"roast" in b ? b.roast : "top tracked player"}</p>
                    <div className="mt-3 space-y-2">
                      {podium.map((p, index) => (
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
          </aside>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
          <h2 className="text-2xl font-black">Tracking roadmap: everything worth tracking</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {trackedSignals.map((signal) => <div key={signal} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">{signal}</div>)}
          </div>
        </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/25 p-3"><p className="text-slate-400">{label}</p><p className="font-bold text-white">{value}</p></div>; }
