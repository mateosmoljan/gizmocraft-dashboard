import { prisma } from "@/lib/prisma";
import { normalizeEmail, usernameFromEmail } from "@/lib/profile-model";

async function uniqueUsername(seed: string, currentUserId?: string) {
  const base = seed || "player";
  for (let i = 0; i < 100; i += 1) {
    const username = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!existing || existing.id === currentUserId) return username;
  }
  return `${base}-${Date.now()}`.slice(0, 32);
}

export async function findPlayerUuidForEmail(email: string) {
  const match = await prisma.playerEmail.findUnique({
    where: { email: normalizeEmail(email) },
    select: { playerUuid: true },
  });
  return match?.playerUuid ?? null;
}

export async function getOrCreateUserProfile(input: { email: string; name?: string | null; image?: string | null; emailVerified?: Date | null }) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email }, include: { player: true } });
  const linkedPlayerUuid = existing?.minecraftUuid ?? (await findPlayerUuidForEmail(email));

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name ?? input.name ?? undefined,
        image: existing.image ?? input.image ?? undefined,
        emailVerified: existing.emailVerified ?? input.emailVerified ?? undefined,
        minecraftUuid: existing.minecraftUuid ?? linkedPlayerUuid ?? undefined,
      },
      include: { player: true },
    });
  }

  const username = await uniqueUsername(usernameFromEmail(email));
  return prisma.user.create({
    data: {
      email,
      username,
      name: input.name ?? email.split("@")[0],
      image: input.image ?? null,
      emailVerified: input.emailVerified ?? null,
      minecraftUuid: linkedPlayerUuid ?? undefined,
    },
    include: { player: true },
  });
}

export async function updateUserProfile(userId: string, input: { username?: string; name?: string; image?: string }) {
  const username = input.username ? await uniqueUsername(input.username, userId) : undefined;
  return prisma.user.update({
    where: { id: userId },
    data: { ...input, ...(username ? { username } : {}) },
    include: { player: true },
  });
}

export async function publicProfiles(limit = 100) {
  return prisma.user.findMany({
    take: limit,
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, username: true, name: true, image: true, minecraftUuid: true, player: { select: { uuid: true, name: true, avatarUrl: true, lastSeenAt: true } } },
  });
}
