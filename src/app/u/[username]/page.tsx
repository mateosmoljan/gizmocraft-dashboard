import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { knownProfileForEmail } from "@/lib/known-profiles";
import { publicProfileByUsername } from "@/lib/profile-store";
import { formatZagrebDateTime } from "@/lib/time";

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
  const playtime = playerPlaytime(profile.player, latest);
  const sessions = playerSessions(profile.player);

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
          <div className="mt-8 grid gap-4 md:grid-cols-[0.9fr_1.5fr]">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-100/80">Minecraft playtime</p>
              <p className="mt-3 text-4xl font-black text-white">{formatDuration(playtime)}</p>
              <p className="mt-2 text-sm text-slate-300">Total time played by this linked Minecraft player.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-emerald-100/80">Session logs</p>
                  <h2 className="mt-1 text-2xl font-black">Recent joins and leaves</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">{sessions.length} shown</span>
              </div>
              {sessions.length ? (
                <div className="mt-4 space-y-3">
                  {sessions.map((entry) => (
                    <div key={entry.key} className="rounded-2xl bg-white/8 p-4 text-sm">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-bold text-white">{formatDuration(entry.durationMs)}</p>
                        <p className="text-slate-300">{entry.leftAt ? "Completed" : "Online / open"}</p>
                      </div>
                      <p className="mt-2 text-slate-300">Joined: {formatZagrebDateTime(entry.joinedAt)}</p>
                      <p className="text-slate-400">Left: {entry.leftAt ? formatZagrebDateTime(entry.leftAt) : "still playing"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white/8 p-4 text-sm text-slate-300">No session logs recorded for this profile yet.</p>
              )}
            </div>
          </div>
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

function playerPlaytime(player: unknown, latest: unknown) {
  const fromPlayer = bigintLikeValue(player, "totalPlayMs");
  if (fromPlayer > 0) return fromPlayer;
  const playTicks = bigintLikeValue(latest, "playTicks");
  return playTicks > 0 ? playTicks * 50 : 0;
}

function playerSessions(player: unknown) {
  if (!player || typeof player !== "object") return [];
  const sessions = (player as Record<string, unknown>).sessions;
  if (!Array.isArray(sessions)) return [];
  return sessions.slice(0, 12).map((session, index) => {
    const record = session && typeof session === "object" ? session as Record<string, unknown> : {};
    const joinedAt = dateValue(record.joinedAt);
    const leftAt = dateValue(record.leftAt);
    const durationMs = bigintLikeValue(record, "durationMs") || (joinedAt && leftAt ? leftAt.getTime() - joinedAt.getTime() : joinedAt ? Date.now() - joinedAt.getTime() : 0);
    return {
      key: String(record.id ?? `${joinedAt?.toISOString() ?? "session"}-${index}`),
      joinedAt: joinedAt ?? new Date(0),
      leftAt,
      durationMs: Math.max(0, durationMs),
    };
  });
}

function bigintLikeValue(source: unknown, key: string) {
  if (!source || typeof source !== "object") return 0;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-sm text-slate-400">{label}</p><p className="text-2xl font-black">{new Intl.NumberFormat("en").format(value)}</p></div>;
}
