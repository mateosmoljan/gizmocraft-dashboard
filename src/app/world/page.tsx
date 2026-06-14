import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { WorldMapDashboard } from "@/components/world-map-dashboard";
import { authOptions } from "@/lib/auth";
import { emptyWorldMapData, getWorldMapData } from "@/lib/world-map";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  const initialData = await getWorldMapData().catch(() => emptyWorldMapData());

  return (
    <GizmoShell>
      <WorldMapDashboard initialData={initialData} />
    </GizmoShell>
  );
}
