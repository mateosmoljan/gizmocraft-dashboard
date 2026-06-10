import { GizmoShell } from "@/components/gizmo-shell";
import { ScreenshotsDashboard } from "@/components/screenshots-dashboard";
import { getScreenshotFeed } from "@/lib/screenshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScreenshotsPage() {
  const initialFeed = await getScreenshotFeed();
  return <GizmoShell><ScreenshotsDashboard initialFeed={initialFeed} /></GizmoShell>;
}
