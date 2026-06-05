import { prisma } from "@/lib/prisma";
import { knownProfileForEmail, knownPublicProfiles } from "@/lib/known-profiles";
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
  const normalized = normalizeEmail(email);
  const known = knownProfileForEmail(normalized);
  try {
    const match = await prisma.playerEmail.findUnique({
      where: { email: normalized },
      select: { playerUuid: true },
    });
    return match?.playerUuid ?? known?.minecraftUuid ?? null;
  } catch {
    return known?.minecraftUuid ?? null;
  }
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

  const username = await uniqueUsername(knownProfileForEmail(email)?.username ?? usernameFromEmail(email));
  return prisma.user.create({
    data: {
      email,
      username,
      name: input.name ?? knownProfileForEmail(email)?.name ?? email.split("@")[0],
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
  const known = await knownPublicProfiles();
  try {
    const profiles = await prisma.user.findMany({
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, username: true, name: true, image: true, minecraftUuid: true, player: { select: { uuid: true, name: true, avatarUrl: true, lastSeenAt: true } } },
    });
    const seen = new Set(profiles.flatMap((profile) => [profile.username, profile.minecraftUuid].filter(Boolean)));
    return [...profiles, ...known.filter((profile) => !seen.has(profile.username) && !seen.has(profile.minecraftUuid))].slice(0, limit);
  } catch {
    return known.slice(0, limit);
  }
}
