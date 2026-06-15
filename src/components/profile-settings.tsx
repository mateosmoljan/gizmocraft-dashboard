"use client";

import { useRef, useState } from "react";
import { formatPlaytimeMs } from "@/lib/playtime";

type MinecraftStatus = "played_before" | "has_minecraft" | "no_minecraft";
type Profile = {
  username: string;
  name: string | null;
  image: string | null;
  email: string;
  minecraftUuid?: string | null;
  onboarding?: { minecraftStatus?: MinecraftStatus; minecraftUsername?: string | null; preferences?: string | null } | null;
  player?: { name: string; uuid: string; totalPlayMs?: number | bigint | string | null } | null;
};

const minecraftOptions: Array<{ value: MinecraftStatus; title: string; detail: string }> = [
  { value: "played_before", title: "I already played on the GizmoCraft world", detail: "We will try to match this Google account to the existing world player data." },
  { value: "has_minecraft", title: "I have Minecraft, but I have not played this world yet", detail: "We will save your Minecraft name now and auto-link once you join the world." },
  { value: "no_minecraft", title: "No Minecraft account yet", detail: "Nothing else appears. You can still use the website profile and add Minecraft later." },
];

export function ProfileSettings({ profile }: { profile: Profile }) {
  const initialMinecraftStatus: MinecraftStatus = profile.onboarding?.minecraftStatus ?? (profile.player?.name ? "played_before" : "no_minecraft");
  const [form, setForm] = useState({
    username: profile.username,
    name: profile.name ?? "",
    image: profile.image ?? "",
    minecraftStatus: initialMinecraftStatus,
    minecraftUsername: profile.onboarding?.minecraftUsername ?? profile.player?.name ?? "",
    preferences: profile.onboarding?.preferences ?? "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const asksForMinecraftName = form.minecraftStatus !== "no_minecraft";

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
    if (asksForMinecraftName && !form.minecraftUsername.trim()) {
      setStatus("Add your exact Minecraft username, or choose No Minecraft account yet.");
      return;
    }
    setStatus("Saving…");
    const payload = { ...form, minecraftUsername: asksForMinecraftName ? form.minecraftUsername : "" };
    const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      setStatus("Could not save profile");
      return;
    }
    const data = await res.json();
    if (data.profile) {
      setForm({
        username: data.profile.username,
        name: data.profile.name ?? "",
        image: data.profile.image ?? "",
        minecraftStatus: data.profile.onboarding?.minecraftStatus ?? form.minecraftStatus,
        minecraftUsername: data.profile.onboarding?.minecraftUsername ?? data.profile.player?.name ?? payload.minecraftUsername ?? "",
        preferences: data.profile.onboarding?.preferences ?? form.preferences ?? "",
      });
    }
    setStatus(data.profile?.player ? "Saved — your Google account is linked to your Minecraft player." : "Saved — if that Minecraft name joins the world later, GizmoCraft will auto-link it to this profile.");
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
            <span className="grid gap-1 text-center"><span className="text-3xl">✎</span><span>Edit</span></span>
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProfileImage(file); event.currentTarget.value = ""; }} />
        <h2 className="text-2xl font-black">{form.name || profile.email}</h2>
        <p className="text-emerald-200">@{form.username}</p>
        <p className="mt-3 text-sm text-slate-400">Google email: {profile.email}</p>
        <p className="mt-3 text-sm text-slate-300">Minecraft: {profile.player?.name ?? (form.minecraftUsername || "Not linked yet")}</p>
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${profile.minecraftUuid || profile.player?.uuid ? "bg-lime-300/10 text-lime-100" : "bg-amber-300/10 text-amber-100"}`}>
          {profile.minecraftUuid || profile.player?.uuid ? "Ownership: this Google account is mapped to the linked Minecraft player." : form.minecraftStatus === "has_minecraft" ? "Ownership: Minecraft name saved; auto-link waits until that player joins the world." : "Ownership: no Minecraft player is attached to this Google account yet."}
        </p>
        {profile.player ? <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">Total playtime: {formatPlaytimeMs(profile.player.totalPlayMs)}</p> : null}
      </aside>

      <section className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200/80">New user setup</p>
        <h1 className="mt-2 text-3xl font-black">Tell GizmoCraft how to wire your profile</h1>
        <p className="mt-2 text-slate-300">Everything except the Minecraft identity choice can be skipped. By default, the website uses your Google name and image, and you can change this later.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-300">Website username<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="grid gap-2 text-sm text-slate-300">How should we call you on the website?<input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="Skip to keep Google name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>

          <fieldset className="grid gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
            <legend className="px-2 text-sm font-black text-emerald-100">Minecraft identity (required)</legend>
            {minecraftOptions.map((option) => (
              <label key={option.value} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                <input type="radio" name="minecraftStatus" value={option.value} checked={form.minecraftStatus === option.value} onChange={() => setForm({ ...form, minecraftStatus: option.value, minecraftUsername: option.value === "no_minecraft" ? "" : form.minecraftUsername })} />
                <span><span className="block font-black text-white">{option.title}</span><span className="text-xs text-slate-400">{option.detail}</span></span>
              </label>
            ))}
          </fieldset>

          {asksForMinecraftName ? (
            <label className="grid gap-2 text-sm text-slate-300">
              Minecraft username you own
              <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="Exact in-game name, e.g. Gizmeta" value={form.minecraftUsername} onChange={(e) => setForm({ ...form, minecraftUsername: e.target.value })} />
              <span className="text-xs text-slate-500">If this matches a player already seen in the world, we claim that player now. If not, we keep the name and auto-link the first time that Minecraft name appears.</span>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm text-slate-300">
            Preferences or notes for the world
            <textarea className="min-h-24 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white" placeholder="Optional: peaceful building, farms, mining, notifications, accessibility, etc." value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
          </label>
          <p className="text-xs text-slate-500">Click the avatar to import a profile image. Use Google image resets it back to your Google account image.</p>
          <button type="button" onClick={() => setForm({ ...form, image: "" })} className="w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">Use Google image</button>
          <button type="button" onClick={save} className="w-fit rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950">Save setup</button>
          {status ? <p className="text-sm text-emerald-200">{status}</p> : null}
        </div>
      </section>
    </div>
  );
}
