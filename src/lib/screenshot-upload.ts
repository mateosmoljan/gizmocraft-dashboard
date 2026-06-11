import { bridgeRequestInit } from "@/lib/dashboard-data";
import { bridgeUrlFromEnv } from "@/lib/world-map";

export const SCREENSHOT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function normalizeScreenshotPlayer(value: FormDataEntryValue | string | null | undefined) {
  const player = String(value ?? "").trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(player) ? player : null;
}

export function validateScreenshotFile(file: File | null | undefined) {
  if (!file || !(file instanceof File)) return "image file required";
  if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) return "Use PNG, JPEG, or WebP screenshots";
  if (file.size <= 0) return "image file is empty";
  if (file.size > SCREENSHOT_UPLOAD_MAX_BYTES) return "Screenshot must be 15 MB or smaller";
  return null;
}

export async function uploadScreenshotToBridge(file: File, player: string) {
  const headers = new Headers(bridgeRequestInit().headers);
  headers.set("content-type", file.type);

  const res = await fetch(`${bridgeUrlFromEnv()}/api/screenshots/upload?player=${encodeURIComponent(player)}`, {
    method: "POST",
    headers,
    body: await file.arrayBuffer(),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `bridge screenshot upload ${res.status}`);
  }

  return res.json();
}
