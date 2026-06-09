import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MinecraftDashboard } from "@/components/dashboard";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  return <GizmoShell title="Player cards" subtitle="Tracked Minecraft players and their funniest stats."><MinecraftDashboard view="players" /></GizmoShell>;
}
