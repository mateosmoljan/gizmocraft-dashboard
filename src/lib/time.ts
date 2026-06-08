export const GIZMO_TIME_ZONE = "Europe/Zagreb";

function dateFrom(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatZagrebDateTime(value: string | number | Date) {
  const date = dateFrom(value);
  if (!date) return "unknown";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: GIZMO_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)} Zagreb`;
}

export function formatZagrebTime(value: string | number | Date) {
  const date = dateFrom(value);
  if (!date) return "unknown";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: GIZMO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)} Zagreb`;
}
