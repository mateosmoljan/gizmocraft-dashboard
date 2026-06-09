import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MinecraftDashboard } from "@/components/dashboard";
import { GizmoShell } from "@/components/gizmo-shell";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signing");

  return <GizmoShell title="Tracking map" subtitle="Everything collected from the Gizmo Ivan world files."><MinecraftDashboard view="tracking" /></GizmoShell>;
}
