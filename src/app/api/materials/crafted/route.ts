import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { minecraftMaterials, materialById } from "@/lib/minecraft-materials";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/profile-model";

export const dynamic = "force-dynamic";

let tableReady: Promise<void> | null = null;

function ensureCraftedTable() {
  tableReady ??= prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crafted_materials (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_email VARCHAR(191) NOT NULL,
      item_id VARCHAR(191) NOT NULL,
      crafted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY crafted_materials_user_item_key (user_email, item_id),
      KEY crafted_materials_user_email_idx (user_email),
      KEY crafted_materials_item_id_idx (item_id)
    )
  `).then(() => undefined);
  return tableReady;
}

async function currentEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ? normalizeEmail(session.user.email) : null;
}

async function readCrafted(email: string) {
  await ensureCraftedTable();
  const rows = await prisma.$queryRaw<Array<{ item_id: string }>>`SELECT item_id FROM crafted_materials WHERE user_email = ${email} ORDER BY item_id ASC`;
  return rows.map((row) => row.item_id).filter((itemId) => materialById.has(itemId));
}

function itemIdFromBody(body: unknown) {
  const itemId = typeof body === "object" && body && "itemId" in body ? String((body as { itemId?: unknown }).itemId ?? "") : "";
  if (!materialById.has(itemId)) return null;
  return itemId;
}

export async function GET() {
  const email = await currentEmail();
  if (!email) {
    return NextResponse.json({ crafted: [], totalCraftable: minecraftMaterials.stats.items, authenticated: false });
  }
  try {
    return NextResponse.json({ crafted: await readCrafted(email), totalCraftable: minecraftMaterials.stats.items, authenticated: true });
  } catch (error) {
    console.warn("crafted materials read failed", error);
    return NextResponse.json({ error: "crafted_tracking_unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const itemId = itemIdFromBody(await req.json().catch(() => null));
  if (!itemId) return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  try {
    await ensureCraftedTable();
    await prisma.$executeRaw`INSERT IGNORE INTO crafted_materials (user_email, item_id) VALUES (${email}, ${itemId})`;
    return NextResponse.json({ crafted: await readCrafted(email), totalCraftable: minecraftMaterials.stats.items, authenticated: true });
  } catch (error) {
    console.warn("crafted materials mark failed", error);
    return NextResponse.json({ error: "crafted_tracking_unavailable" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const itemId = itemIdFromBody(await req.json().catch(() => null));
  if (!itemId) return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  try {
    await ensureCraftedTable();
    await prisma.$executeRaw`DELETE FROM crafted_materials WHERE user_email = ${email} AND item_id = ${itemId}`;
    return NextResponse.json({ crafted: await readCrafted(email), totalCraftable: minecraftMaterials.stats.items, authenticated: true });
  } catch (error) {
    console.warn("crafted materials unmark failed", error);
    return NextResponse.json({ error: "crafted_tracking_unavailable" }, { status: 503 });
  }
}
