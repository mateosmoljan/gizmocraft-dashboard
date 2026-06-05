import { notFound } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicUserProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await prisma.user.findUnique({
    where: { username },
    include: { player: { include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } } },
  }).catch(() => null);
  if (!profile) notFound();
  const latest = profile.player?.snapshots[0];

  return (
    <GizmoShell title={`@${profile.username}`} subtitle="Public GizmoCraft profile and Minecraft stat snapshot.">
      <section className="mx-auto max-w-4xl">
        <a className="text-sm text-emerald-200" href="/profiles">← Profiles</a>
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-8 backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="grid size-28 place-items-center overflow-hidden rounded-3xl bg-emerald-300/10 text-5xl">
              {profile.image ? <img src={profile.image} alt="" className="h-full w-full object-cover" /> : "🧑"}
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
              <Stat label="Deaths" value={latest.deaths} />
              <Stat label="Mobs" value={latest.mobsKilled} />
              <Stat label="Mined" value={latest.blocksMined} />
              <Stat label="Diamonds" value={latest.diamondsMined} />
            </div>
          ) : null}
        </div>
      </section>
    </GizmoShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-sm text-slate-400">{label}</p><p className="text-2xl font-black">{new Intl.NumberFormat("en").format(value)}</p></div>;
}
