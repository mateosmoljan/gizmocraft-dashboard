export function DataExplainButton({ label, explanation }: { label: string; explanation: string }) {
  return (
    <span className="group relative inline-flex shrink-0 items-center justify-center">
      <button
        type="button"
        aria-label={`Explain ${label}`}
        title={explanation}
        className="grid size-6 place-items-center rounded-full border border-emerald-200/35 bg-emerald-300/10 text-xs font-black text-emerald-100 transition hover:border-emerald-100 hover:bg-emerald-300/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70"
      >!</button>
      <span className="pointer-events-none absolute right-0 top-8 z-30 w-64 rounded-2xl border border-emerald-200/25 bg-slate-950/95 p-3 text-left text-xs font-medium leading-relaxed text-slate-100 opacity-0 shadow-2xl shadow-black/50 backdrop-blur transition group-focus-within:opacity-100 group-hover:opacity-100">
        {explanation}
      </span>
    </span>
  );
}
