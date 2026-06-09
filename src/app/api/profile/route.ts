import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { knownProfileForEmail } from "@/lib/known-profiles";
import { profileUpdateFromInput } from "@/lib/profile-model";
import { getOrFallbackUserProfile, updateUserProfileForEmail } from "@/lib/profile-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getOrFallbackUserProfile({ email: session.user.email, name: session.user.name, image: session.user.image });
  return NextResponse.json({ profile, ownership: ownershipFor(session.user.email, profile) });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const update = profileUpdateFromInput(await req.json());
  const profile = await updateUserProfileForEmail(email, update, session.user?.image);
  return NextResponse.json({ profile, ownership: ownershipFor(email, profile) });
}

function ownershipFor(email: string, profile: any) {
  const known = knownProfileForEmail(email);
  const minecraftUuid = profile?.minecraftUuid ?? profile?.player?.uuid ?? known?.minecraftUuid ?? null;
  return {
    linked: Boolean(minecraftUuid),
    source: known ? "known-email" : minecraftUuid ? "profile" : "unlinked",
    username: known?.username ?? profile?.username,
    minecraftUuid: minecraftUuid ?? undefined,
    minecraftName: profile?.player?.name ?? known?.name,
  };
}
