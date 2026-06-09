import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function SigningPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) redirect("/dashboard");
  const preview = await getDashboardData().catch(() => null);
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#245c43_0,#07111f_35%,#040913_100%)] px-5 py-10 text-white">
      <SignInPrompt callbackUrl="/dashboard" players={preview?.players ?? []} worldStats={preview?.worldStats ?? null} live={Boolean(preview?.live)} />
    </main>
  );
}
