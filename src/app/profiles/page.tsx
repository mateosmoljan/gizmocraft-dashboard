import { getServerSession } from "next-auth";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { knownProfileForEmail } from "@/lib/known-profiles";
import { formatPlaytimeHours, formatPlaytimeMs } from "@/lib/playtime";
import { publicProfiles } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const session = await getServerSession(authOptions);
  let profiles: Awaited<ReturnType<typeof publicProfiles>> = [];
  try {
    profiles = await publicProfiles(200);
  } catch {
    profiles = [];
  }
  const known = session?.user?.email ? knownProfileForEmail(session.user.email) : null;
  const sessionImage = session?.user?.image ?? null;
  const displayProfiles = profiles.map((profile) =>
    known && sessionImage && (profile.username === known.username || profile.minecraftUuid === known.minecraftUuid)
      ? { ...profile, image: profile.image ?? sessionImage }
      : profile,
  );

  return (
    <GizmoShell title="Public profiles" subtitle="Browse GizmoCraft users, usernames, and linked Minecraft players.">
      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft people</p>
            <h1 className="mt-2 text-4xl font-black">Public profiles</h1>
          </div>
          <a className="rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950" href="/profile">Edit my profile</a>
        </div>

        {displayProfiles.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {displayProfiles.map((p) => (
              <a key={p.id} href={`/u/${p.username}`} className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur transition hover:bg-white/12">
                <div className="mb-4 grid size-16 place-items-center overflow-hidden rounded-2xl bg-emerald-300/10 text-3xl">
                  {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : "🧑"}
                </div>
                <h2 className="text-2xl font-black">{p.name ?? p.username}</h2>
                <p className="text-emerald-200">@{p.username}</p>
                <p className="mt-3 text-sm text-slate-300">Minecraft: {p.player?.name ?? "unlinked"}</p>
                {p.player ? <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">Total playtime: {profilePlaytime(p.player)}</p> : null}
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-slate-300">No public profiles yet. Profiles appear after players sign in with Google.</div>
        )}
      </section>
    </GizmoShell>
  );
}

function profilePlaytime(player: unknown) {
  if (!player || typeof player !== "object") return "0m";
  const record = player as Record<string, unknown>;
  const totalPlayMs = record.totalPlayMs;
  if (totalPlayMs) return formatPlaytimeMs(totalPlayMs as number | bigint | string);
  const stats = record.stats;
  if (stats && typeof stats === "object") return formatPlaytimeHours(Number((stats as Record<string, unknown>).playHours ?? 0));
  const snapshots = record.snapshots;
  if (Array.isArray(snapshots) && snapshots[0] && typeof snapshots[0] === "object") return formatPlaytimeHours(Number((snapshots[0] as Record<string, unknown>).playHours ?? 0));
  return "0m";
}
