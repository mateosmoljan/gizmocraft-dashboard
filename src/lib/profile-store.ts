import { prisma } from "@/lib/prisma";
import { bridgeRequestInit } from "@/lib/dashboard-data";
import { knownPlayerProfiles, knownProfileForEmail, knownPublicProfiles } from "@/lib/known-profiles";
import { normalizeEmail, usernameFromEmail } from "@/lib/profile-model";

const PROFILE_DB_TIMEOUT_MS = 900;
type ProfileUpdate = { username?: string; name?: string; image?: string | null };
export type AppUserStats = { online: number; totalSignedIn: number; live: boolean };
const APP_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function bridgeUrl() {
  return process.env.MINECRAFT_BRIDGE_URL || "http://gizmo-server:3020";
}

function withProfileDbTimeout<T>(task: Promise<T>) {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("profile_db_timeout")), PROFILE_DB_TIMEOUT_MS)),
  ]);
}

export function fallbackUserProfile(input: { email: string; name?: string | null; image?: string | null }) {
  const email = normalizeEmail(input.email);
  const known = knownProfileForEmail(email);
  return {
    id: `fallback-${email}`,
    email,
    emailVerified: null,
    username: known?.username ?? usernameFromEmail(email),
    name: input.name ?? known?.name ?? email.split("@")[0],
    image: input.image ?? null,
    role: "PLAYER" as const,
    minecraftUuid: known?.minecraftUuid ?? null,
    lastLoginAt: null,
    signInCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    player: known
      ? {
          uuid: known.minecraftUuid,
          name: known.name,
        }
      : null,
  };
}

async function bridgeJson<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit = bridgeRequestInit();
  const res = await fetch(`${bridgeUrl()}${path}`, {
    ...requestInit,
    ...init,
    headers: {
      ...(requestInit.headers as Record<string, string> | undefined),
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`bridge ${res.status}`);
  return res.json() as Promise<T>;
}

async function bridgeUpdateUserProfile(email: string, input: ProfileUpdate, googleImage?: string | null) {
  const known = knownProfileForEmail(email);
  const data = await bridgeJson<{ profile: any }>("/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email), minecraftUuid: known?.minecraftUuid, ...input, googleImage }),
  });
  return data.profile;
}

async function bridgePublicProfiles(limit = 100) {
  const data = await bridgeJson<{ profiles: any[] }>(`/api/profiles?limit=${limit}`);
  return data.profiles;
}

async function bridgeTouchAppActivity(email: string) {
  const data = await bridgeJson<{ stats: AppUserStats }>("/api/app-activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
  return { ...data.stats, live: true };
}

async function databaseTouchAppActivity(email: string) {
  const now = new Date();
  await withProfileDbTimeout(prisma.user.update({ where: { email: normalizeEmail(email) }, data: { appLastSeenAt: now } }));
  const onlineSince = new Date(Date.now() - APP_ONLINE_WINDOW_MS);
  const [online, totalSignedIn] = await withProfileDbTimeout(Promise.all([
    prisma.user.count({ where: { appLastSeenAt: { gte: onlineSince } } }),
    prisma.user.count({ where: { signInCount: { gt: 0 } } }),
  ]));
  return { online, totalSignedIn, live: true };
}

export async function touchAndReadAppUserStats(email: string): Promise<AppUserStats> {
  try {
    return await bridgeTouchAppActivity(email);
  } catch (bridgeError) {
    console.warn("App stats bridge unavailable; trying direct profile database", bridgeError);
  }

  try {
    return await databaseTouchAppActivity(email);
  } catch (dbError) {
    console.warn("App stats database unavailable", dbError);
    return { online: 0, totalSignedIn: 0, live: false };
  }
}

export async function publicProfileByUsername(username: string) {
  const knownProfile = knownPlayerProfiles.find((entry) => entry.username === username);
  if (knownProfile) {
    try {
      const profiles = await bridgePublicProfiles(200);
      const bridgeProfile = profiles.find((entry) => entry.minecraftUuid === knownProfile.minecraftUuid);
      if (bridgeProfile) return { ...bridgeProfile, username: knownProfile.username };
    } catch {
      // Fall through to the normal lookup path.
    }
  }
  try {
    const data = await bridgeJson<{ profile: any }>(`/api/profiles/${encodeURIComponent(username)}`);
    return data.profile;
  } catch {
    const dbProfile = await prisma.user.findUnique({
      where: { username },
      include: { player: { include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } } },
    }).catch(() => null);
    return dbProfile ?? (await knownPublicProfiles()).find((entry) => entry.username === username) ?? null;
  }
}

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
      signInCount: 0,
    },
    include: { player: true },
  });
}

export async function recordUserSignIn(input: { email: string; name?: string | null; image?: string | null; emailVerified?: Date | null }) {
  const profile = await getOrCreateUserProfile(input);
  return prisma.user.update({
    where: { id: profile.id },
    data: {
      lastLoginAt: new Date(),
      signInCount: { increment: 1 },
      name: profile.name ?? input.name ?? undefined,
      image: profile.image ?? input.image ?? undefined,
    },
    include: { player: true },
  });
}

export async function recordOrFallbackUserSignIn(input: { email: string; name?: string | null; image?: string | null; emailVerified?: Date | null }) {
  try {
    return await withProfileDbTimeout(recordUserSignIn(input));
  } catch (error) {
    console.warn("Profile database unavailable; using fallback profile", error);
    const fallback = fallbackUserProfile(input);
    return await bridgeUpdateUserProfile(input.email, { username: fallback.username, name: fallback.name, image: input.image ?? null }, input.image).catch(() => fallback);
  }
}

export async function getOrFallbackUserProfile(input: { email: string; name?: string | null; image?: string | null; emailVerified?: Date | null }) {
  try {
    return await withProfileDbTimeout(getOrCreateUserProfile(input));
  } catch (error) {
    console.warn("Profile database unavailable; using fallback profile", error);
    const fallback = fallbackUserProfile(input);
    return await bridgeUpdateUserProfile(input.email, { username: fallback.username, name: fallback.name, image: input.image ?? null }, input.image).catch(() => fallback);
  }
}

export async function updateUserProfile(userId: string, input: ProfileUpdate) {
  const username = input.username ? await uniqueUsername(input.username, userId) : undefined;
  return prisma.user.update({
    where: { id: userId },
    data: { ...input, ...(username ? { username } : {}) },
    include: { player: true },
  });
}

export async function updateUserProfileForEmail(email: string, input: ProfileUpdate, googleImage?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  const image = input.image ?? googleImage ?? null;
  try {
    return await bridgeUpdateUserProfile(normalizedEmail, { ...input, image }, googleImage);
  } catch (bridgeError) {
    console.warn("Profile bridge update unavailable; trying direct profile database", bridgeError);
  }

  try {
    const profile = await withProfileDbTimeout(getOrCreateUserProfile({ email: normalizedEmail, image: googleImage }));
    return await withProfileDbTimeout(updateUserProfile(profile.id, { ...input, image }));
  } catch (dbError) {
    console.warn("Profile database update unavailable; returning fallback profile", dbError);
    const fallback = fallbackUserProfile({ email: normalizedEmail, image: googleImage });
    return {
      ...fallback,
      username: input.username ?? fallback.username,
      name: input.name ?? fallback.name,
      image,
      updatedAt: new Date(),
    };
  }
}

export async function publicProfiles(limit = 100) {
  const known = await knownPublicProfiles();
  try {
    const profiles = (await bridgePublicProfiles(limit)).map((profile) => {
      const knownProfile = known.find((entry) => entry.minecraftUuid === profile.minecraftUuid);
      return knownProfile ? { ...profile, username: knownProfile.username } : profile;
    });
    const seen = new Set(profiles.flatMap((profile) => [profile.username, profile.minecraftUuid].filter(Boolean)));
    return [...profiles, ...known.filter((profile) => !seen.has(profile.username) && !seen.has(profile.minecraftUuid))].slice(0, limit);
  } catch {
    // Fall back to direct DB or known source-controlled profiles below.
  }
  try {
    const profiles = await withProfileDbTimeout(prisma.user.findMany({
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, username: true, name: true, image: true, minecraftUuid: true, player: { select: { uuid: true, name: true, avatarUrl: true, lastSeenAt: true } } },
    }));
    const seen = new Set(profiles.flatMap((profile) => [profile.username, profile.minecraftUuid].filter(Boolean)));
    return [...profiles, ...known.filter((profile) => !seen.has(profile.username) && !seen.has(profile.minecraftUuid))].slice(0, limit);
  } catch {
    return known.slice(0, limit);
  }
}
