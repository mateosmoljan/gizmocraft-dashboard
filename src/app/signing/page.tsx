import { SignInPrompt } from "@/components/sign-in-prompt";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SigningPage() {
  const preview = await getDashboardData().catch(() => null);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#245c43_0,#07111f_35%,#040913_100%)] px-5 py-10 text-white">
      <SignInPrompt callbackUrl="/dashboard" players={preview?.players} worldStats={preview?.worldStats} live={Boolean(preview?.live)} />
    </main>
  );
}
