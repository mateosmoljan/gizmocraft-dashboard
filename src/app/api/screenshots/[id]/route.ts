import { NextRequest, NextResponse } from "next/server";
import { fetchScreenshotImage } from "@/lib/screenshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetchScreenshotImage(id);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: text || `screenshot image returned ${res.status}` }, { status: res.status });
  }

  const headers = new Headers();
  headers.set("content-type", res.headers.get("content-type") || "image/png");
  const versioned = req.nextUrl.searchParams.has("v");
  headers.set("cache-control", versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, stale-while-revalidate=86400");
  const length = res.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new NextResponse(res.body, { status: 200, headers });
}
