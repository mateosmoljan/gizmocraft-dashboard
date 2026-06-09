"use client";

import { useRef, useState } from "react";
import { formatPlaytimeMs } from "@/lib/playtime";

type Profile = {
  username: string;
  name: string | null;
  image: string | null;
  email: string;
  minecraftUuid?: string | null;
  player?: { name: string; uuid: string; totalPlayMs?: number | bigint | string | null } | null;
};

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({ username: profile.username, name: profile.name ?? "", image: profile.image ?? "", minecraftUsername: profile.player?.name ?? "" });
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function importProfileImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file.");
      return;
    }

    setStatus("Preparing image…");
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    await image.decode();

    const maxSize = 512;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    let quality = 0.72;
    while (dataUrl.length > 90_000 && canvas.width > 160 && canvas.height > 160) {
      const nextCanvas = document.createElement("canvas");
      nextCanvas.width = Math.round(canvas.width * 0.82);
      nextCanvas.height = Math.round(canvas.height * 0.82);
      nextCanvas.getContext("2d")?.drawImage(canvas, 0, 0, nextCanvas.width, nextCanvas.height);
      canvas.width = nextCanvas.width;
      canvas.height = nextCanvas.height;
      canvas.getContext("2d")?.drawImage(nextCanvas, 0, 0);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      quality = Math.max(0.58, quality - 0.06);
    }

    if (dataUrl.length > 100_000) {
      setStatus("Image is too large. Choose a smaller image or crop it first.");
      return;
    }

    setForm((current) => ({ ...current, image: dataUrl }));
    setStatus("Image imported. Save profile to publish it.");
  }

  async function save() {
    setStatus("Saving…");
    const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      setStatus("Could not save profile");
      return;
    }
    const data = await res.json();
    if (data.profile) setForm({ username: data.profile.username, name: data.profile.name ?? "", image: data.profile.image ?? "", minecraftUsername: data.profile.player?.name ?? form.minecraftUsername ?? "" });
    setStatus("Saved — this profile now links to your Minecraft player when the username matches world data.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative mb-4 grid size-28 place-items-center overflow-hidden rounded-3xl border border-emerald-300/20 bg-emerald-300/10 text-5xl outline-none ring-emerald-300/40 transition hover:border-emerald-200/60 focus-visible:ring-4"
          aria-label="Import profile image from your device"
          title="Click to import a profile image"
        >
          {form.image ? <img src={form.image} alt="Profile picture" className="h-full w-full object-cover" /> : "🧑"}
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-black text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="grid gap-1 text-center">
              <span className="text-3xl">✎</span>
              <span>Edit</span>
            </span>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importProfileImage(file);
            event.currentTarget.value = "";
          }}
        />
        <h2 className="text-2xl font-black">{form.name || profile.email}</h2>
        <p className="text-emerald-200">@{form.username}</p>
        <p className="mt-3 text-sm text-slate-400">Google email: {profile.email}</p>
        <p className="mt-3 text-sm text-slate-300">Minecraft: {profile.player?.name ?? "Not linked yet"}</p>
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${profile.minecraftUuid || profile.player?.uuid ? "bg-lime-300/10 text-lime-100" : "bg-amber-300/10 text-amber-100"}`}>
          {profile.minecraftUuid || profile.player?.uuid ? "Ownership: this Google account is mapped to the linked Minecraft player." : "Ownership: no Minecraft player is attached to this Google account yet."}
        </p>
        {profile.player ? <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">Total playtime: {formatPlaytimeMs(profile.player.totalPlayMs)}</p> : null}
      </aside>

      <section className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
        <h1 className="text-3xl font-black">Profile settings</h1>
        <p className="mt-2 text-slate-300">Edit your public GizmoCraft profile. Emails can be pre-attached to Minecraft players, so a Google login claims the right player automatically.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-300">Username<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="grid gap-2 text-sm text-slate-300">Display name<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="grid gap-2 text-sm text-slate-300">
            Minecraft username
            <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="Exact in-game name, e.g. Gizmeta" value={form.minecraftUsername} onChange={(e) => setForm({ ...form, minecraftUsername: e.target.value })} />
            <span className="text-xs text-slate-500">If this matches a player from the world data, GizmoCraft links that Minecraft playtime/stats to this Google profile.</span>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Profile image URL
            <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="https://..." value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <span className="text-xs text-slate-500">Click the avatar to import from your PC or phone gallery, or paste an image URL. Leave empty to use your Google account image by default.</span>
          </label>
          <button type="button" onClick={() => setForm({ ...form, image: "" })} className="w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">Use Google image</button>
          <button type="button" onClick={save} className="w-fit rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950">Save profile</button>
          {status ? <p className="text-sm text-emerald-200">{status}</p> : null}
        </div>
      </section>
    </div>
  );
}
