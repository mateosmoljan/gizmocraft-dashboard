import { SignInPrompt } from "@/components/sign-in-prompt";

export const dynamic = "force-static";

export default function SigningPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#245c43_0,#07111f_35%,#040913_100%)] px-5 py-10 text-white">
      <SignInPrompt callbackUrl="/dashboard" />
    </main>
  );
}
