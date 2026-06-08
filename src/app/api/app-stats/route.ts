import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { touchAndReadAppUserStats } from "@/lib/profile-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stats = await touchAndReadAppUserStats(email);
  return NextResponse.json({ stats }, { headers: { "cache-control": "no-store" } });
}
