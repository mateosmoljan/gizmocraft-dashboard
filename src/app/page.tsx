import { MinecraftDashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Home() {
  const data = await getDashboardData();
  return <MinecraftDashboard {...data} />;
}
