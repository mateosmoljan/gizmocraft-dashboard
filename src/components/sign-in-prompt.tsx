export function SignInPrompt({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const signInHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-300/20 bg-white/8 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
      <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">GizmoCraft access</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Sign in to open the dashboard</h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-300">
        Use Google once and your browser will keep an active session cookie, so you do not have to log in every visit.
      </p>
      <a className="mt-7 inline-flex rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950 shadow-lg shadow-emerald-950/30" href={signInHref}>
        Sign in with Google
      </a>
      <p className="mt-5 text-xs text-slate-500">
        We store only basic account/profile info for the dashboard: email, name, avatar, linked Minecraft player, sign-in count, and latest sign-in time.
      </p>
    </section>
  );
}
