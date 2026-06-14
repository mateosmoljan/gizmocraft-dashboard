import "./globals.css";
import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  applicationName: "GizmoCraft",
  title: "GizmoCraft Dashboard",
  description: "Public Minecraft player profiles, leaderboards, and world stats for Gizmo Ivan.",
  appleWebApp: {
    capable: true,
    title: "GizmoCraft",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#064e3b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ServiceWorkerRegistration />{children}</body></html>;
}
