import { GizmoShell } from "@/components/gizmo-shell";
import { WorldMapDashboard } from "@/components/world-map-dashboard";

export const dynamic = "force-dynamic";

export default function WorldPage() {
  return <GizmoShell><WorldMapDashboard /></GizmoShell>;
}
