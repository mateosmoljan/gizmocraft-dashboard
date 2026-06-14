"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Camera, Globe2, Settings, Trophy, UserRound, Users } from "lucide-react";
import { gizmoNavItems } from "@/lib/navigation";
import { InstallAppButton } from "@/components/install-app-button";
import { MinecraftScene } from "@/components/minecraft-scene";

const icons = [BarChart3, Globe2, Camera, UserRound, Trophy, Activity, Users, Settings];
type AppStats = { online: number; totalSignedIn: number; live: boolean };
type AppStatsState = AppStats | null;

export function GizmoShell({ children }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [appStats, setAppStats] = useState<AppStatsState>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function loadAppStats() {
      const res = await fetch("/api/app-stats", { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setAppStats(null);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setAppStats(data.stats?.live ? data.stats : null);
      }
    }
    void loadAppStats();
    const interval = window.setInterval(() => void loadAppStats(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const pending = pendingHref !== null && pendingHref !== pathname;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#245c43_0,#07111f_35%,#040913_100%)] text-white">
      <MinecraftScene />
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        <aside className="flex flex-col border-b border-white/10 bg-slate-950/75 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center gap-3">
            <img
              src="/brand/gizmocraft-floating-world-logo.png"
              alt="GizmoCraft floating world logo"
              className="size-14 shrink-0 rounded-2xl object-contain drop-shadow-[0_0_22px_rgba(45,212,191,0.38)]"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">GizmoCraft</p>
              <h1 className="text-lg font-black">Command</h1>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {gizmoNavItems.map((item, index) => {
              const Icon = icons[index];
              const activePath = pendingHref ?? pathname;
              const active = activePath === item.href || (item.href === "/dashboard" && activePath === "/");
              const itemPending = pendingHref === item.href && pending;
              return (
                <Link key={item.href} href={item.href} onClick={() => setPendingHref(item.href)} className={`group relative flex min-w-[160px] items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-sm transition lg:min-w-0 ${active ? "scale-[1.02] border-emerald-300/40 bg-emerald-300/12 text-white shadow-[0_0_22px_rgba(52,211,153,0.14)]" : "border-transparent text-slate-400 hover:border-emerald-300/20 hover:bg-white/6 hover:text-slate-100"}`}>
                  {itemPending ? <span className="absolute inset-x-3 bottom-1 h-0.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.8)]" /> : null}
                  <Icon className={`h-5 w-5 shrink-0 ${itemPending ? "animate-bounce text-emerald-200" : ""}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-bold">{item.name}</span>
                    <span className="hidden truncate text-xs text-slate-500 lg:block">{itemPending ? "Loading chunks…" : item.description}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 hidden rounded-3xl border border-lime-300/20 bg-lime-300/8 p-4 lg:block">
            <p className="text-xs uppercase tracking-[0.25em] text-lime-200/70">World</p>
            <p className="mt-2 font-black">Gizmo Ivan — Dole</p>
            <p className="mt-1 text-sm text-slate-400">Hard survival · live bridge</p>
          </div>

          <InstallAppButton />

          <div className="mt-4 rounded-3xl border border-emerald-300/20 bg-emerald-300/8 p-4 lg:mt-auto">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">App users</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-2xl font-black text-white">{appStats ? appStats.online : "—"}</p>
                <p className="text-xs text-slate-400">active last 5 min</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">{appStats ? appStats.totalSignedIn : "—"}</p>
                <p className="text-xs text-slate-400">Google users total</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">{appStats ? "Live app activity only, not Minecraft players." : "Live app activity unavailable."}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
