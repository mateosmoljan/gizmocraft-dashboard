import { createHash } from "node:crypto";
import { getDashboardData, type DashboardPlayer } from "@/lib/dashboard-data";
import { normalizeEmail, normalizeUsername } from "@/lib/profile-model";
import { players as fallbackPlayers } from "@/lib/sample-data";

export type KnownPlayerProfile = {
  username: string;
  name: string;
  minecraftUuid: string;
  emailSha256: string;
};

export const knownPlayerProfiles = [
  {
    username: "gmrooster",
    name: "GMRooster",
    minecraftUuid: "5e8db67a-1249-44dc-a053-713bd8a8844a",
    emailSha256: "480d7ed333490ce6d95f6e2bba9248c91d50f3817922be4e74f9726501ece880",
  },
  {
    username: "djolearmani",
    name: "DjoleArmani",
    minecraftUuid: "1fa45424-66b3-4996-aeb7-089d78bc367c",
    emailSha256: "b2327aa51941924d2610f3223725f19713cd1c7636ba98f05124cf3883dfc0aa",
  },
  {
    username: "sudodosu",
    name: "Gizmeta",
    minecraftUuid: "947b65ff-be0f-4e25-8778-25e53f93e423",
    emailSha256: "42d94604a3228273235d286b407dd05765f304b7ad099373c8b9dca267c962b5",
  },
] as const satisfies readonly KnownPlayerProfile[];

export function emailHash(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function knownProfileForEmail(email: string) {
  const hash = emailHash(email);
  return knownPlayerProfiles.find((profile) => profile.emailSha256 === hash) ?? null;
}

export function knownProfileByUsername(username: string) {
  const normalized = normalizeUsername(username);
  return knownPlayerProfiles.find((profile) => profile.username === normalized) ?? null;
}

export async function knownPublicProfiles() {
  const dashboard = await getDashboardData().catch(() => null);
  const livePlayers: DashboardPlayer[] = dashboard?.players?.length ? dashboard.players : fallbackPlayers;
  return knownPlayerProfiles.map((profile) => {
    const player = livePlayers.find((entry) => entry.uuid === profile.minecraftUuid || entry.name === profile.name);
    return {
      id: `known-${profile.username}`,
      username: profile.username,
      name: profile.name,
      image: null,
      minecraftUuid: profile.minecraftUuid,
      player: {
        uuid: profile.minecraftUuid,
        name: profile.name,
        avatarUrl: null,
        lastSeenAt: null,
        stats: player ?? null,
      },
    };
  });
}
