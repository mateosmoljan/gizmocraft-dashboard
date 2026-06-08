export function MinecraftLoading({ compact = false }: { compact?: boolean }) {
  const blocks = ["bg-emerald-400", "bg-lime-300", "bg-stone-400", "bg-amber-500", "bg-sky-400"];

  if (compact) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-slate-950/45 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(52,211,153,0.08),transparent)] animate-pulse" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">Loading chunks</p>
            <p className="mt-1 font-black text-white">Keeping the nav planted — mining this section only…</p>
          </div>
          <div className="grid size-14 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10">
            <span className="animate-bounce text-2xl">⛏️</span>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-emerald-200/20" />
              <div className="mt-3 h-8 w-28 animate-pulse rounded bg-white/15" />
              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {blocks.map((color, blockIndex) => (
                  <div key={`${index}-${color}`} className={`h-6 rounded-lg ${color} opacity-70 animate-pulse`} style={{ animationDelay: `${(index + blockIndex) * 90}ms` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-slate-950/80 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Loading chunks</p>
          <h1 className="mt-2 text-3xl font-black text-white">Mining the next screen…</h1>
          <p className="mt-2 text-sm text-slate-300">Fetching fresh GizmoCraft data from the server bridge.</p>
        </div>
        <div className="relative grid size-20 place-items-center rounded-3xl border border-emerald-300/25 bg-emerald-300/10">
          <div className="absolute h-14 w-14 animate-spin rounded-full border-4 border-emerald-300/20 border-t-emerald-300" />
          <span className="animate-bounce text-3xl">⛏️</span>
        </div>
      </div>
    </div>
  );
}
