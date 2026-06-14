import { formatPlaytimeHours } from "@/lib/playtime";
import type { DashboardData } from "@/lib/dashboard-data";

type PreviewPlayer = DashboardData["players"][number];
type PreviewWorld = DashboardData["worldStats"];

export function SignInPrompt({ callbackUrl = "/dashboard", players = [], worldStats, live = false }: { callbackUrl?: string; players?: PreviewPlayer[]; worldStats?: PreviewWorld | null; live?: boolean }) {
  const signInHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const topPlayers = players.slice(0, 3);
  const king = topPlayers[0];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section className="grid gap-5 rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="text-center lg:text-left">
          <img
            src="/brand/gizmocraft-floating-world-logo.png"
            alt="GizmoCraft floating world logo"
            className="mx-auto size-24 object-contain drop-shadow-[0_0_30px_rgba(45,212,191,0.42)] lg:mx-0"
          />
          <p className="mt-4 text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft access</p>
          <h1 className="mt-3 text-4xl font-black md:text-6xl">The Minecraft dashboard is live</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300 lg:mx-0">
            Sign in with Google to open your player profile, private settings, full stat cards, and the complete rivalry boards for the Gizmo Ivan hard-survival world.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a className="inline-flex rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950 shadow-lg shadow-emerald-950/30" href={signInHref}>
              Sign in with Google
            </a>
            <a className="inline-flex rounded-full border border-emerald-300/30 px-6 py-3 font-black text-emerald-100" href="/api/public/leaderboards">
              Public live JSON
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            We store only basic account/profile info for the dashboard: email, name, avatar, linked Minecraft player, sign-in count, and latest sign-in time.
          </p>
        </div>

        <aside className="rounded-3xl border border-lime-300/20 bg-slate-950/55 p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-lime-200/80">Public preview</p>
              <h2 className="mt-2 text-2xl font-black">{worldStats?.name ?? "Gizmo Ivan — Dole"}</h2>
              <p className="mt-1 text-sm text-slate-400">{live ? "Live bridge data" : "Waiting for bridge"} · {worldStats?.trackedPlayers ?? players.length} tracked</p>
            </div>
            <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-bold text-lime-100">{worldStats?.playersOnline ?? 0}/{worldStats?.maxPlayers ?? 10} online</span>
          </div>

          {king ? (
            <div className="mt-5 rounded-2xl bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Current king</p>
              <p className="mt-2 text-3xl font-black">{king.avatar} {king.name}</p>
              <p className="mt-1 text-sm text-slate-300">{king.diamonds} diamonds · {formatPlaytimeHours(king.playHours)} played · {king.mobsKilled} mobs bullied</p>
            </div>
          ) : <p className="mt-5 rounded-2xl bg-black/20 p-4 text-sm text-slate-300">Live leaderboard preview will appear as soon as the bridge returns players.</p>}

          <div className="mt-4 space-y-2">
            {topPlayers.map((player, index) => (
              <div key={player.uuid} className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-sm">
                <span className="font-bold text-slate-100">#{index + 1} {player.name}</span>
                <span className="text-right text-slate-300">{player.diamonds} 💎 · {formatPlaytimeHours(player.playHours)}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
