# AGENTS.md — Minecraft Dashboard / Gizmo Ivan

## Source identity

- Canonical project path: `/home/cisco/projects/MinecraftDashboard`.
- Minecraft world/server data source: `gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan`.
- Active world folder: `gizmo-ivan-dole`.
- UI deployment target: Vercel public dashboard.
- Database target: MySQL on `gizmo-server`/laptop server.
- Public connectivity pattern: Vercel UI calls an authenticated HTTPS bridge/API on `gizmo-server`; the bridge talks to local MySQL and Minecraft files. Do **not** expose raw MySQL publicly.

## Required workflow

1. Work from `/home/cisco/projects/MinecraftDashboard`.
2. Inspect Minecraft source data through SSH on `gizmo-server` before collector/schema changes.
3. Keep secrets out of repo: Google OAuth, bridge token, database URL, and any MySQL password stay in env only.
4. Verify UI visually before reporting success.
5. Verify data freshness from `/api/health`, bridge sync time, and at least one leaderboard.
