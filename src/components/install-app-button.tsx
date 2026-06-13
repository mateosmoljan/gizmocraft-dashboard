"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneApp());
    setShowIosInstallHelp(isIosBrowser() && !isStandaloneApp());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandaloneApp()) {
        setInstallPrompt(event as BeforeInstallPromptEvent);
      }
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    const media = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      if (isStandaloneApp()) {
        setInstalled(true);
        setInstallPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    media.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      media.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  if (installed || (!installPrompt && !showIosInstallHelp)) return null;

  async function installApp() {
    const prompt = installPrompt;
    if (!prompt) {
      window.alert("To install GizmoCraft on iPhone: tap Share, then Add to Home Screen.");
      return;
    }

    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted" || isStandaloneApp()) {
      setInstalled(true);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void installApp()}
      className="mt-4 flex w-full items-center justify-between rounded-2xl border border-emerald-300/30 bg-emerald-300/12 px-4 py-3 text-left text-sm text-emerald-50 shadow-[0_0_22px_rgba(52,211,153,0.10)] transition hover:border-emerald-200/60 hover:bg-emerald-300/18"
    >
      <span>
        <span className="block text-xs uppercase tracking-[0.22em] text-emerald-200/70">Install</span>
        <span className="mt-1 block font-black">Add GizmoCraft</span>
        <span className="mt-0.5 block text-xs text-slate-400">{installPrompt ? "Open like an app" : "Share → Add to Home Screen"}</span>
      </span>
      <Download className="h-5 w-5 text-emerald-200" aria-hidden="true" />
    </button>
  );
}
