import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { knownProfileForEmail } from "@/lib/known-profiles";
import { publicProfileByUsername } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

export default async function PublicUserProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await publicProfileByUsername(username);
  if (!profile) notFound();
  const session = await getServerSession(authOptions);
  const known = session?.user?.email ? knownProfileForEmail(session.user.email) : null;
  const profileImage = known && session?.user?.image && (profile.username === known.username || profile.minecraftUuid === known.minecraftUuid)
    ? profile.image ?? session.user.image
    : profile.image;
  const latest = latestStatsForPlayer(profile.player);

  return (
    <GizmoShell title={`@${profile.username}`} subtitle="Public GizmoCraft profile and Minecraft stat snapshot.">
      <section className="mx-auto max-w-4xl">
        <a className="text-sm text-emerald-200" href="/profiles">← Profiles</a>
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-8 backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="grid size-28 place-items-center overflow-hidden rounded-3xl bg-emerald-300/10 text-5xl">
              {profileImage ? <img src={profileImage} alt="" className="h-full w-full object-cover" /> : "🧑"}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Public player profile</p>
              <h1 className="mt-2 text-5xl font-black">{profile.name ?? profile.username}</h1>
              <p className="text-emerald-200">@{profile.username}</p>
              <p className="mt-3 text-slate-300">Minecraft: {profile.player?.name ?? "Not linked"}</p>
            </div>
          </div>
          {latest ? (
            <div className="mt-8 grid gap-3 md:grid-cols-4">
              <Stat label="Deaths" value={statValue(latest, "deaths")} />
              <Stat label="Mobs" value={statValue(latest, "mobsKilled")} />
              <Stat label="Mined" value={statValue(latest, "blocksMined")} />
              <Stat label="Diamonds" value={statValue(latest, "diamondsMined", "diamonds")} />
            </div>
          ) : null}
        </div>
      </section>
    </GizmoShell>
  );
}

function latestStatsForPlayer(player: unknown) {
  if (!player || typeof player !== "object") return null;
  const record = player as Record<string, unknown>;
  const snapshots = record.snapshots;
  if (Array.isArray(snapshots)) return snapshots[0] ?? null;
  return record.stats ?? null;
}

function statValue(source: unknown, primary: string, fallback?: string) {
  if (!source || typeof source !== "object") return 0;
  const record = source as Record<string, unknown>;
  return Number(record[primary] ?? (fallback ? record[fallback] : 0) ?? 0);
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-sm text-slate-400">{label}</p><p className="text-2xl font-black">{new Intl.NumberFormat("en").format(value)}</p></div>;
}
