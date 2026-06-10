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
      "cache-control": "no-store, max-age=0",
    },
  });
}
