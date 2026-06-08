import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bridgeRequestInit } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function databaseStatus() {
  if (!process.env.DATABASE_URL) return { configured: false, connected: false };
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2500);
    return { configured: true, connected: true };
  } catch (error) {
    console.warn("Health check database probe failed", error);
    return { configured: true, connected: false };
  }
}

async function bridgeStatus() {
  const bridgeUrl = process.env.MINECRAFT_BRIDGE_URL;
  if (!bridgeUrl) return { configured: false, connected: false };
  try {
    const res = await fetch(`${bridgeUrl}/api/health`, {
      ...bridgeRequestInit(),
      signal: AbortSignal.timeout(2500),
    });
    return { configured: true, connected: res.ok };
  } catch (error) {
    console.warn("Health check bridge probe failed", error);
    return { configured: true, connected: false };
  }
}

export async function GET() {
  const [database, bridge] = await Promise.all([databaseStatus(), bridgeStatus()]);
  return NextResponse.json({ status: "ok", app: "minecraft-dashboard", world: "gizmo-ivan-dole", database, bridge });
}
