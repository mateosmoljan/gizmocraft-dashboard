import { bridgeRequestInit } from "@/lib/dashboard-data";
import { bridgeUrlFromEnv } from "@/lib/world-map";

export type PlayerScreenshot = {
  id: string;
  fileName: string;
  player: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  capturedAt: string;
  modifiedAt: string;
  contentType: string;
};

export type ScreenshotFeed = {
  live: boolean;
  checkedAt: string;
  source: string;
  screenshots: PlayerScreenshot[];
  count: number;
  note?: string;
  error?: string;
};

export function emptyScreenshotFeed(error?: unknown): ScreenshotFeed {
  return {
    live: false,
    checkedAt: new Date().toISOString(),
    source: "bridge unavailable",
    screenshots: [],
    count: 0,
    note: "Live screenshots appear here as soon as the bridge receives image files from players.",
    error: error ? String(error instanceof Error ? error.message : error) : undefined,
  };
}

export async function getScreenshotFeed(): Promise<ScreenshotFeed> {
  try {
    const res = await fetch(`${bridgeUrlFromEnv()}/api/screenshots`, {
      ...bridgeRequestInit(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`bridge screenshots ${res.status}`);
    const data = await res.json();
    return { ...data, live: true };
  } catch (error) {
    return emptyScreenshotFeed(error);
  }
}

export async function fetchScreenshotImage(id: string) {
  return fetch(`${bridgeUrlFromEnv()}/api/screenshots/${encodeURIComponent(id)}`, {
    ...bridgeRequestInit(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}
