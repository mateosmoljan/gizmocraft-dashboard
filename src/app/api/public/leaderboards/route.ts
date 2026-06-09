import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json(data, {
    status: data.live ? 200 : 503,
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}
