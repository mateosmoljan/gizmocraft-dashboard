import { GizmoShell } from "@/components/gizmo-shell";
import { publicProfiles } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let profiles: Awaited<ReturnType<typeof publicProfiles>> = [];
  try {
    profiles = await publicProfiles(200);
  } catch {
    profiles = [];
  }

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

        {profiles.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {profiles.map((p) => (
              <a key={p.id} href={`/u/${p.username}`} className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur transition hover:bg-white/12">
                <div className="mb-4 grid size-16 place-items-center overflow-hidden rounded-2xl bg-emerald-300/10 text-3xl">
                  {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : "🧑"}
                </div>
                <h2 className="text-2xl font-black">{p.name ?? p.username}</h2>
                <p className="text-emerald-200">@{p.username}</p>
                <p className="mt-3 text-sm text-slate-300">Minecraft: {p.player?.name ?? "unlinked"}</p>
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
