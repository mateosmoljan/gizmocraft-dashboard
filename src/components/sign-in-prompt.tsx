export function SignInPrompt({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const signInHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-3xl border border-emerald-300/20 bg-white/8 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur lg:text-left">
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft access</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">The Minecraft dashboard is live</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300 lg:mx-0">
          Sign in with Google to open your player profile, private settings, full stat cards, and the complete rivalry boards for the Gizmo Ivan hard-survival world.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
          <a className="inline-flex rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950 shadow-lg shadow-emerald-950/30" href={signInHref}>
            Sign in with Google
          </a>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          We store only basic account/profile info for the dashboard: email, name, avatar, linked Minecraft player, sign-in count, and latest sign-in time.
        </p>
      </section>
    </div>
  );
}
