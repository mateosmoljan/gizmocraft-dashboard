import type { DashboardPlayer, DashboardWorld } from "@/lib/dashboard-data";

function format(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function SignInPrompt({
  callbackUrl = "/dashboard",
  preview,
}: {
  callbackUrl?: string;
  preview?: { players: DashboardPlayer[]; worldStats: DashboardWorld; live: boolean };
}) {
  const signInHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const topPlayers = preview?.players.slice(0, 3) ?? [];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1fr_0.95fr]">
      <section className="rounded-3xl border border-emerald-300/20 bg-white/8 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur lg:text-left">
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft access</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">The Minecraft dashboard is live</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300 lg:mx-0">
          Sign in with Google to open your player profile, private settings, full stat cards, and the complete rivalry boards for the Gizmo Ivan hard-survival world.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
          <a className="inline-flex rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950 shadow-lg shadow-emerald-950/30" href={signInHref}>
            Sign in with Google
          </a>
          <a className="inline-flex rounded-full border border-emerald-300/30 px-6 py-3 font-black text-emerald-100" href="/api/public/leaderboards">
            Public live data API
          </a>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          We store only basic account/profile info for the dashboard: email, name, avatar, linked Minecraft player, sign-in count, and latest sign-in time.
        </p>
      </section>

      <section className="rounded-3xl border border-lime-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-lime-200/80">Public preview</p>
            <h2 className="mt-2 text-3xl font-black text-white">{preview?.worldStats.name ?? "Gizmo Ivan — Dole"}</h2>
            <p className="mt-1 text-sm text-slate-400">{preview?.worldStats.difficulty ?? "Hard Survival"} · {preview?.worldStats.trackedPlayers ?? topPlayers.length} tracked players</p>
          </div>
          <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-bold text-lime-100">
            {preview?.live ? "Live bridge" : "Preview"}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {topPlayers.map((player, index) => (
            <div key={player.uuid} className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-black text-white">#{index + 1} {player.avatar} {player.name}</p>
                  <p className="text-xs text-slate-400">Last seen: {player.lastSeen}</p>
                </div>
                <p className="rounded-full bg-amber-300/20 px-3 py-1 text-sm font-black text-amber-100">{format(player.score)}</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <MiniStat label="Deaths" value={player.deaths} />
                <MiniStat label="Mined" value={player.blocksMined} />
                <MiniStat label="Diamonds" value={player.diamonds} />
                <MiniStat label="Mobs" value={player.mobsKilled} />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-2xl bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          Public preview shows enough to prove the dashboard exists; full boards and profile editing unlock after Google sign-in.
        </p>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-black/25 p-2">
      <p className="text-slate-400">{label}</p>
      <p className="font-black text-white">{format(value)}</p>
    </div>
  );
}
