import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { profileUpdateFromInput } from "@/lib/profile-model";
import { getOrFallbackUserProfile, updateUserProfileForEmail } from "@/lib/profile-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getOrFallbackUserProfile({ email: session.user.email, name: session.user.name, image: session.user.image });
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const update = profileUpdateFromInput(await req.json());
  const profile = await updateUserProfileForEmail(email, update, session.user?.image);
  return NextResponse.json({ profile });
}
