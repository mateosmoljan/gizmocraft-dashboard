import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/profile-model";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (actor?.role !== "ADMIN") return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const body = await req.json();
  if (typeof body.email !== "string" || typeof body.playerUuid !== "string") {
    return NextResponse.json({ error: "email_and_playerUuid_required" }, { status: 400 });
  }

  const link = await prisma.playerEmail.upsert({
    where: { email: normalizeEmail(body.email) },
    update: { playerUuid: body.playerUuid, label: body.label ?? null, source: "admin" },
    create: { email: normalizeEmail(body.email), playerUuid: body.playerUuid, label: body.label ?? null, source: "admin" },
  });
  return NextResponse.json({ link });
}
