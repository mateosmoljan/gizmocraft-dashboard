import { getServerSession } from "next-auth";
import { GizmoShell } from "@/components/gizmo-shell";
import { MaterialsDashboard } from "@/components/materials-dashboard";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.email);

  return (
    <GizmoShell title="Materials & Crafting" subtitle="Search official Minecraft recipes and track what you have crafted.">
      <MaterialsDashboard signedIn={signedIn} userName={session?.user?.name ?? session?.user?.email ?? null} />
    </GizmoShell>
  );
}
