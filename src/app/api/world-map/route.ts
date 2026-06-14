import { NextResponse } from "next/server";
import { getWorldMapData } from "@/lib/world-map";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET() {
  const data = await getWorldMapData();
  return NextResponse.json(data, {
    status: data.live ? 200 : 503,
    headers: {
      "cache-control": data.live
        ? "public, max-age=10, s-maxage=15, stale-while-revalidate=60"
        : "no-store, max-age=0",
      "x-world-map-version": data.mapMemory.version,
    },
  });
}
