"use client";

import { useEffect, useMemo, useState } from "react";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
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
const PROFILES_CACHE_KEY = "gizmocraft:last-public-profiles";
const PROFILES_AUTO_REFRESH_MS = 30 * 1000;

export function PublicProfiles() {
  const [payload, setPayload] = useState<ProfilesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const profiles = useMemo(() => payload?.profiles ?? [], [payload]);

  async function refresh(force = false) {
    if (force) setRefreshing(true);
    try {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      if (!res.ok) throw new Error(`profiles ${res.status}`);
      const next = { ...(await res.json()), fetchedAt: Date.now() } as ProfilesPayload;
      setPayload(next);
      writeClientCache(PROFILES_CACHE_KEY, next);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async (force = false) => {
      if (force && !cancelled) setRefreshing(true);
      try {
        const res = await fetch("/api/profiles", { cache: "no-store" });
        if (!res.ok) throw new Error(`profiles ${res.status}`);
        const next = { ...(await res.json()), fetchedAt: Date.now() } as ProfilesPayload;
        if (!cancelled) {
          setPayload(next);
          writeClientCache(PROFILES_CACHE_KEY, next);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    const cached = readClientCache<ProfilesPayload>(PROFILES_CACHE_KEY);
    if (cached?.profiles?.length) {
      setPayload(cached);
      setLoading(false);
    }

    void loadProfiles(false);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadProfiles(false);
    }, PROFILES_AUTO_REFRESH_MS);

    const refreshOnFocus = () => void loadProfiles(false);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft people</p>
          <h1 className="mt-2 text-4xl font-black">Public profiles</h1>
          <p className="mt-2 text-sm text-slate-400">{refreshing ? "Updating profiles…" : payload ? failed ? "Showing saved profiles" : "Profiles ready" : "Loading profiles"}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && !profiles.length ? <span className="size-3 animate-pulse rounded-full bg-emerald-300" aria-label="Loading profiles" /> : null}
          <button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-100 disabled:cursor-wait disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh"}</button>
          <a className="rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950" href="/profile">Edit my profile</a>
        </div>
      </div>

      {profiles.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
        </div>
      ) : loading ? (
        <div className="grid min-h-48 place-items-center rounded-3xl border border-white/10 bg-white/8 p-8 backdrop-blur">
          <span className="size-4 animate-ping rounded-full bg-emerald-300" aria-label="Loading profiles" />
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-slate-300">No public profiles yet. Profiles appear after players sign in with Google.</div>
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
