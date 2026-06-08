"use client";

import { useState } from "react";

type Profile = {
  username: string;
  name: string | null;
  image: string | null;
  email: string;
  player?: { name: string; uuid: string } | null;
};

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({ username: profile.username, name: profile.name ?? "", image: profile.image ?? "" });
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus("Saving…");
    const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      setStatus("Could not save profile");
      return;
    }
    const data = await res.json();
    if (data.profile) setForm({ username: data.profile.username, name: data.profile.name ?? "", image: data.profile.image ?? "" });
    setStatus("Saved — this image now follows your attached GizmoCraft profile.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
        <div className="mb-4 size-28 overflow-hidden rounded-3xl border border-emerald-300/20 bg-emerald-300/10 text-5xl grid place-items-center">
          {form.image ? <img src={form.image} alt="Profile picture" className="h-full w-full object-cover" /> : "🧑"}
        </div>
        <h2 className="text-2xl font-black">{form.name || profile.email}</h2>
        <p className="text-emerald-200">@{form.username}</p>
        <p className="mt-3 text-sm text-slate-400">Google email: {profile.email}</p>
        <p className="mt-3 text-sm text-slate-300">Minecraft: {profile.player?.name ?? "Not linked yet"}</p>
      </aside>

      <section className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
        <h1 className="text-3xl font-black">Profile settings</h1>
        <p className="mt-2 text-slate-300">Edit your public GizmoCraft profile. Emails can be pre-attached to Minecraft players, so a Google login claims the right player automatically.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-300">Username<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="grid gap-2 text-sm text-slate-300">Display name<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="grid gap-2 text-sm text-slate-300">
            Profile image URL
            <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="https://..." value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <span className="text-xs text-slate-500">Leave empty to use your Google account image by default.</span>
          </label>
          <button type="button" onClick={() => setForm({ ...form, image: "" })} className="w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">Use Google image</button>
          <button type="button" onClick={save} className="w-fit rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950">Save profile</button>
          {status ? <p className="text-sm text-emerald-200">{status}</p> : null}
        </div>
      </section>
    </div>
  );
}
