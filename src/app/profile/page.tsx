import { getServerSession } from "next-auth";
import { ProfileSettings } from "@/components/profile-settings";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { getOrFallbackUserProfile } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return (
      <GizmoShell title="Profile settings" subtitle="Sign in to claim and customize your GizmoCraft player profile.">
        <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/8 p-8 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft profiles</p>
          <h1 className="mt-3 text-4xl font-black">Sign in to claim your player</h1>
          <p className="mt-3 text-slate-300">Use the same Google email Mateo attaches to your Minecraft username.</p>
          <a className="mt-6 inline-flex rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950" href="/api/auth/signin/google?callbackUrl=/profile">Sign in with Google</a>
        </section>
      </GizmoShell>
    );
  }

  const profile = await getOrFallbackUserProfile({ email: session.user.email, name: session.user.name, image: session.user.image });

  return (
    <GizmoShell title="Profile settings" subtitle="Edit your public username, display name, picture, and linked Minecraft identity.">
      <div className="mb-5 flex items-center justify-end">
        <a className="text-sm text-slate-300" href="/api/auth/signout">Sign out</a>
      </div>
      <ProfileSettings profile={profile} />
    </GizmoShell>
  );
}
