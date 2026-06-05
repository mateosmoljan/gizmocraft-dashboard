import { MinecraftDashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <MinecraftDashboard {...data} />;
}
