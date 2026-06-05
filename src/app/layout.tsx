import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GizmoCraft Dashboard",
  description: "Public Minecraft player profiles, leaderboards, and world stats for Gizmo Ivan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
