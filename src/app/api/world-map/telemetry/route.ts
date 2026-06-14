import { NextResponse } from "next/server";
import { bridgeRequestInit } from "@/lib/dashboard-data";
import { bridgeUrlFromEnv, normalizeWorldMapTelemetry } from "@/lib/world-map";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const telemetry = normalizeWorldMapTelemetry(payload);
    const headers = new Headers(bridgeRequestInit().headers as HeadersInit | undefined);
    headers.set("content-type", "application/json");
    const res = await fetch(`${bridgeUrlFromEnv()}/api/world-map/telemetry`, {
      method: "POST",
      headers,
      body: JSON.stringify(telemetry),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`bridge telemetry ${res.status}`);
    return NextResponse.json({ ok: true, telemetry }, { status: 202, headers: { "cache-control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error instanceof Error ? error.message : error) }, { status: 400, headers: { "cache-control": "no-store, max-age=0" } });
  }
}
