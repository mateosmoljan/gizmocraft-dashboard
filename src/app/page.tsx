import { MinecraftDashboard } from "@/components/dashboard";
import { GizmoShell } from "@/components/gizmo-shell";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Home() {
  const data = await getDashboardData();
  return <GizmoShell title="Minecraft Dashboard" subtitle="Live player profiles, rivalry boards, and world telemetry."><MinecraftDashboard {...data} /></GizmoShell>;
}
