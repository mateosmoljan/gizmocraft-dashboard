import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { GizmoShell } from "@/components/gizmo-shell";
import { UsageDashboard } from "@/components/usage-dashboard";
import { authOptions } from "@/lib/auth";
import { getServerUsage } from "@/lib/server-usage";
import { getChunkSettings } from "@/lib/server-settings";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  const [usage, chunkSettings] = await Promise.all([getServerUsage(), getChunkSettings()]);

  return (
    <GizmoShell title="Server usage" subtitle="Minecraft server health signals for CPU, RAM, disk, network, and player load.">
      <UsageDashboard initialUsage={usage} initialChunkSettings={chunkSettings} />
    </GizmoShell>
  );
}
