# AGENTS.md — Minecraft Dashboard / GizmoCraft

## Source identity

- Canonical project path: `/home/cisco/projects/MinecraftDashboard`.
- Active Minecraft host: `gizmo-server`.
- Active Minecraft server directory on `gizmo-server`: `/home/cisco/minecraft-servers/gizmo-ivan`.
- **Only active gameplay world for future features:** `/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole` (`level-name=gizmo-ivan-dole`, MOTD `Gizmo, Ivan, Dole`, Minecraft `26.1.2`).
- Do **not** apply new features, datapacks, mods, collectors, or live-world dashboard updates to any other world folder unless Mateo explicitly asks to inspect/recover/archive older data.
- Local WSL `/home/cisco/minecraft-servers/gizmo-ivan` was an old mirror/server and is archived/stopped; do not confuse it with the active `gizmo-server` path.
- UI deployment target: Vercel public dashboard.
- Database target: MySQL on business server **Piston** (`piston` / `100.120.246.18`), database `gizmocraft_dashboard`.
- Transfer note: active GizmoCraft dashboard MySQL was moved off the Cisco server laptop to Piston. Agents updating/importing/exporting/querying dashboard DB data must use Piston, not Cisco-local MySQL.
- Public connectivity pattern: Vercel UI calls an authenticated HTTPS bridge/API on **Piston** (`https://piston.tailfca8d2.ts.net/gizmocraft`); the Piston bridge talks to local/private Piston MySQL. `gizmo-server` remains the active Minecraft host/data source, but raw MySQL must not be exposed publicly.

## Required workflow

1. Work from `/home/cisco/projects/MinecraftDashboard`.
2. For Minecraft world/server changes, SSH to `gizmo-server` and verify the active world is `gizmo-ivan-dole` before editing.
3. Apply gameplay datapacks/mods/features only under the active `gizmo-ivan-dole` world, not older `world` folders or local mirrors.
4. Keep secrets out of repo: Google OAuth, bridge token, database URL, and any MySQL password stay in env only.
5. Verify UI visually before reporting success.
6. Verify data freshness from `/api/health`, bridge sync time, and at least one leaderboard.
