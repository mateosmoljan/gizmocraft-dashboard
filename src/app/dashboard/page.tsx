import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MinecraftDashboard } from "@/components/dashboard";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  return <GizmoShell title="Minecraft Overview" subtitle="Clean world snapshot with quick links to the separate boards."><MinecraftDashboard view="overview" /></GizmoShell>;
}
