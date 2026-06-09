export function MinecraftLoading({ compact = false }: { compact?: boolean }) {
  const size = compact ? "size-16" : "size-24";
  const ringSize = compact ? "h-12 w-12" : "h-16 w-16";
  const iconSize = compact ? "text-3xl" : "text-4xl";

  return (
    <div className="grid min-h-40 place-items-center" role="status" aria-label="Loading">
      <div className={`relative grid ${size} place-items-center rounded-full bg-emerald-300/10`}>
        <div className={`absolute ${ringSize} animate-spin rounded-full border-4 border-emerald-300/20 border-t-emerald-300`} />
        <span className={`animate-bounce ${iconSize}`} aria-hidden="true">
          ⛏️
        </span>
      </div>
    </div>
  );
}
