import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { getServerUsage, type ServerUsageMetric } from "@/lib/server-usage";
import { formatZagrebTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  const usage = await getServerUsage();

  return (
    <GizmoShell title="Server usage" subtitle="Minecraft server health signals for CPU, RAM, disk, network, and player load.">
      <div className="space-y-6">
        <section className="rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Diagnostics</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">Server usage</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Use this to separate Minecraft server pressure from Wi‑Fi/client lag while everyone is playing.
              </p>
            </div>
            <div className={`rounded-2xl border px-5 py-4 text-right ${usage.live ? "border-lime-300/30 bg-lime-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
              <p className={usage.live ? "text-sm text-lime-200" : "text-sm text-amber-200"}>{usage.live ? "Live" : "Waiting for bridge"}</p>
              <p className="mt-1 text-xs text-slate-300">Checked {formatZagrebTime(usage.checkedAt)}</p>
            </div>
          </div>
        </section>

        {usage.note ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-300/8 p-5 text-amber-100">
            <p className="font-bold">Usage data is not live yet.</p>
            <p className="mt-2 text-sm text-amber-100/80">{usage.note}</p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {usage.metrics.map((entry) => <UsageCard key={entry.label} metric={entry} />)}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="text-2xl font-black">What to watch while lag happens</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Hint title="Server bottleneck" body="High CPU or Minecraft RAM pressure while TPS/player actions stutter." />
            <Hint title="Network/Wi‑Fi bottleneck" body="Server CPU/RAM look normal, but players rubber-band or ping spikes." />
            <Hint title="Storage bottleneck" body="Disk stays busy during world saves, chunk loads, or backups." />
          </div>
        </section>
      </div>
    </GizmoShell>
  );
}

function UsageCard({ metric }: { metric: ServerUsageMetric }) {
  const percent = metric.percent ?? null;
  return (
    <article className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{metric.label}</p>
          <p className="mt-2 text-3xl font-black text-white">{metric.value}</p>
        </div>
        {percent != null ? <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-sm text-emerald-100">{Math.round(percent)}%</span> : null}
      </div>
      {percent != null ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${percent}%` }} /></div> : null}
      {metric.detail ? <p className="mt-3 text-sm text-slate-300">{metric.detail}</p> : null}
    </article>
  );
}

function Hint({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-black text-emerald-100">{title}</p><p className="mt-2 text-sm text-slate-300">{body}</p></div>;
}
