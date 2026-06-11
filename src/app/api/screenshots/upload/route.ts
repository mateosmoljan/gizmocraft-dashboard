import { NextRequest, NextResponse } from "next/server";
import { normalizeScreenshotPlayer, uploadScreenshotToBridge, validateScreenshotFile } from "@/lib/screenshot-upload";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const player = normalizeScreenshotPlayer(form.get("player"));
    if (!player) return NextResponse.json({ error: "Minecraft player name required" }, { status: 400 });

    const file = form.get("screenshot");
    const screenshot = file instanceof File ? file : null;
    const fileError = validateScreenshotFile(screenshot);
    if (fileError || !screenshot) return NextResponse.json({ error: fileError ?? "image file required" }, { status: 400 });

    const data = await uploadScreenshotToBridge(screenshot, player);
    return NextResponse.json(data, {
      status: 201,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
