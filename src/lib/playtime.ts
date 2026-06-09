export function formatPlaytimeHours(hours: number | null | undefined) {
  const safeHours = Number(hours ?? 0);
  if (!Number.isFinite(safeHours) || safeHours <= 0) return "0m";
  return formatPlaytimeMs(safeHours * 60 * 60 * 1000);
}

export function formatPlaytimeMs(ms: number | bigint | string | null | undefined) {
  const value = typeof ms === "bigint" ? Number(ms) : typeof ms === "string" ? Number(ms) : Number(ms ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0m";
  const totalMinutes = Math.round(value / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}
