import { GizmoShell } from "@/components/gizmo-shell";
import { PublicProfiles } from "@/components/public-profiles";

export const dynamic = "force-dynamic";

export default function ProfilesPage() {
  return (
    <GizmoShell title="Public profiles" subtitle="Browse GizmoCraft users, usernames, and linked Minecraft players.">
      <PublicProfiles />
    </GizmoShell>
  );
}
