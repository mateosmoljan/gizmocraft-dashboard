"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPlaytimeHours, formatPlaytimeMs } from "@/lib/playtime";

type PublicProfile = {
  id: string;
  username: string;
  name?: string | null;
  image?: string | null;
  minecraftUuid?: string | null;
  player?: {
    name?: string | null;
    totalPlayMs?: number | bigint | string | null;
    stats?: { playHours?: number | null } | null;
    snapshots?: Array<{ playHours?: number | null }> | null;
  } | null;
};

type ProfilesPayload = { profiles: PublicProfile[]; live: boolean; fetchedAt: number };
const PROFILES_AUTO_REFRESH_MS = 30 * 1000;

export function PublicProfiles() {
  const [payload, setPayload] = useState<ProfilesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const profiles = useMemo(() => payload?.profiles ?? [], [payload]);

  const loadProfiles = useCallback(async (showBusy = false) => {
    if (showBusy) setLoading(true);
    try {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      if (!res.ok) throw new Error(`profiles ${res.status}`);
      const next = { ...(await res.json()), fetchedAt: Date.now() } as ProfilesPayload;
      setPayload(next);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadProfiles();
    }, PROFILES_AUTO_REFRESH_MS);

    const refreshOnFocus = () => void loadProfiles();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [loadProfiles]);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft people</p>
          <h1 className="mt-2 text-4xl font-black">Public profiles</h1>
          <p className="mt-2 text-sm text-slate-400">{payload ? failed ? "Waiting for live profiles" : "Profiles ready" : "Loading profiles"}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && !profiles.length ? <span className="size-3 animate-pulse rounded-full bg-emerald-300" aria-label="Loading profiles" /> : null}
          <a className="rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950" href="/profile">Edit my profile</a>
        </div>
      </div>

      {failed && !profiles.length && !loading ? <ProfilesRetryPanel onRetry={() => void loadProfiles(true)} /> : null}

      {profiles.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((index) => <ProfileCardSkeleton key={index} />)}
        </div>
      ) : (
        failed ? null : <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-slate-300">No public profiles yet. Profiles appear after players sign in with Google.</div>
      )}
    </section>
  );
}

function ProfileCard({ profile: p }: { profile: PublicProfile }) {
  return (
    <a href={`/u/${p.username}`} className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur transition hover:bg-white/12">
      <div className="mb-4 grid size-16 place-items-center overflow-hidden rounded-2xl bg-emerald-300/10 text-3xl">
        {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : "🧑"}
      </div>
      <h2 className="text-2xl font-black">{p.name ?? p.username}</h2>
      <p className="text-emerald-200">@{p.username}</p>
      <p className="mt-3 text-sm text-slate-300">Minecraft: {p.player?.name ?? "unlinked"}</p>
      {p.player ? <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">Total playtime: {profilePlaytime(p.player)}</p> : null}
    </a>
  );
}

function profilePlaytime(player: NonNullable<PublicProfile["player"]>) {
  const totalPlayMs = player.totalPlayMs;
  if (totalPlayMs) return formatPlaytimeMs(totalPlayMs);
  if (player.stats?.playHours) return formatPlaytimeHours(player.stats.playHours);
  const snapshotPlayHours = player.snapshots?.[0]?.playHours;
  if (snapshotPlayHours) return formatPlaytimeHours(snapshotPlayHours);
  return "0m";
}

function ProfileCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <span className="block size-16 animate-pulse rounded-2xl bg-emerald-200/15" aria-label="Loading profile" />
      <span className="mt-4 block h-6 w-32 animate-pulse rounded-lg bg-emerald-200/15" />
      <span className="mt-3 block h-4 w-44 animate-pulse rounded-lg bg-emerald-200/15" />
      <span className="mt-3 block h-4 w-28 animate-pulse rounded-lg bg-emerald-200/15" />
    </div>
  );
}

function ProfilesRetryPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto mb-6 flex min-h-56 max-w-xl flex-col items-center justify-center rounded-3xl border border-amber-300/25 bg-amber-300/8 p-8 text-center">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-100/80">Database timeout</p>
      <h2 className="mt-2 text-2xl font-black text-white">Profiles did not load</h2>
      <p className="mt-2 text-sm text-slate-300">Automatic retry is still running. You can also refresh now.</p>
      <button type="button" onClick={onRetry} className="mt-5 rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200">Refresh data</button>
    </div>
  );
}
