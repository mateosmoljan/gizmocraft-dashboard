import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MinecraftDashboard } from "@/components/dashboard";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  const data = await getDashboardData();
  return <GizmoShell title="Minecraft Dashboard" subtitle="Live player profiles, rivalry boards, and world telemetry."><MinecraftDashboard {...data} /></GizmoShell>;
}
