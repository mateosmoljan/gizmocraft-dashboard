"use client";

import { useEffect, useState } from "react";

type ProfileResponse = {
  profile: {
    username: string;
    name?: string | null;
    image?: string | null;
    email?: string | null;
    minecraftUuid?: string | null;
    player?: { uuid?: string | null; name?: string | null; totalPlayMs?: number | bigint | string | null; online?: boolean | null } | null;
  };
};

export function DashboardProfileSummary() {
  const [payload, setPayload] = useState<ProfileResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error(`profile ${res.status}`);
        const next = (await res.json()) as ProfileResponse;
        if (!cancelled) {
          setPayload(next);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!payload?.profile) return null;

  const { profile } = payload;
  const playerName = profile.player?.name ?? null;
  const avatar = profile.image;

  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-slate-950/65 p-5 shadow-2xl shadow-black/25 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-3xl">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : "🧑"}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Your signed-in profile</p>
            <h2 className="mt-1 truncate text-2xl font-black">{profile.name || profile.email || profile.username}</h2>
            <p className="mt-1 text-sm text-slate-300">
              @{profile.username}{playerName ? ` · Minecraft: ${playerName}` : ""}
            </p>
          </div>
        </div>

        {failed ? <p className="text-xs text-amber-200">Waiting for live profile data.</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
        <a className="rounded-full bg-emerald-300 px-4 py-2 text-slate-950" href={`/u/${profile.username}`}>Open public profile</a>
        <a className="rounded-full border border-emerald-300/30 px-4 py-2 text-emerald-100" href="/profile">Edit profile</a>
      </div>
    </section>
  );
}
