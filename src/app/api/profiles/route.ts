import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { knownProfileForEmail } from "@/lib/known-profiles";
import { publicProfiles } from "@/lib/profile-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  const known = session?.user?.email ? knownProfileForEmail(session.user.email) : null;
  const sessionImage = session?.user?.image ?? null;
  let profiles: Awaited<ReturnType<typeof publicProfiles>> = [];
  try {
    profiles = await publicProfiles(200);
  } catch {
    profiles = [];
  }
  const displayProfiles = profiles.map((profile) =>
    known && sessionImage && (profile.username === known.username || profile.minecraftUuid === known.minecraftUuid)
      ? { ...profile, image: profile.image ?? sessionImage }
      : profile,
  );

  return NextResponse.json(
    { profiles: displayProfiles, live: true },
    { headers: { "cache-control": "private, no-store, max-age=0" } },
  );
}
