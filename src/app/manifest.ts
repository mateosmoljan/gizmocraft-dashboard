import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/gizmocraft-dashboard",
    name: "GizmoCraft Dashboard",
    short_name: "GizmoCraft",
    description: "Installable GizmoCraft dashboard for live Minecraft world stats, profiles, screenshots, and server tools.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#040913",
    theme_color: "#064e3b",
    categories: ["games", "utilities"],
    icons: [
      {
        src: "/icons/gizmocraft-logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/gizmocraft-logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/gizmocraft-logo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open GizmoCraft command dashboard",
        url: "/dashboard?source=pwa-shortcut",
        icons: [{ src: "/icons/gizmocraft-logo-192.png", sizes: "192x192" }],
      },
      {
        name: "World Map",
        short_name: "World",
        description: "Open the live world map",
        url: "/world?source=pwa-shortcut",
        icons: [{ src: "/icons/gizmocraft-logo-192.png", sizes: "192x192" }],
      },
    ],
  };
}
