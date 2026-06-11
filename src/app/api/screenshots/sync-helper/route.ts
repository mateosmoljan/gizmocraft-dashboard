import { NextRequest, NextResponse } from "next/server";
import { normalizeScreenshotPlayer } from "@/lib/screenshot-upload";
import { buildScreenshotSyncHelperScript } from "@/lib/screenshot-sync-helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const player = normalizeScreenshotPlayer(url.searchParams.get("player")) ?? "PlayerName";
  const baseUrl = url.origin;
  const script = buildScreenshotSyncHelperScript({ player, baseUrl });
  return new NextResponse(script, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="gizmocraft-screenshot-sync-${player}.ps1"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
