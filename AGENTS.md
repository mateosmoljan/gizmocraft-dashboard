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
- Piston stability wiring for all Hermes agents: Piston WSL uses systemd (`PID1=systemd`) with `ssh`, `mysql`, `tailscaled`, `server-room-bridge`, `gizmocraft-dashboard-bridge`, and `gizmocraft-piston-watchdog.timer` active. Windows Task Scheduler task **Hermes Keep Piston Ubuntu WSL Alive** keeps Ubuntu running so WSL does not idle-shutdown and flap Tailscale/Funnel. Do not remove it.
- Piston watchdog rule: `/usr/local/sbin/gizmocraft-piston-watchdog.sh` repairs local services and re-applies `/gizmocraft -> http://127.0.0.1:3020`; it must **not** restart `tailscaled` just because the public Funnel self-check is slow, because that caused the bridge timeouts.
- Current access paths: primary `ssh piston` / `100.120.246.18` into Piston WSL; public bridge `https://piston.tailfca8d2.ts.net/gizmocraft`; active Minecraft host `gizmo-server` / `100.89.200.93` is expected to be separately audited for fallback access when reachable.

## Required workflow

1. Work from `/home/cisco/projects/MinecraftDashboard`.
2. For Minecraft world/server changes, SSH to `gizmo-server` and verify the active world is `gizmo-ivan-dole` before editing.
3. Apply gameplay datapacks/mods/features only under the active `gizmo-ivan-dole` world, not older `world` folders or local mirrors.
4. Keep secrets out of repo: Google OAuth, bridge token, database URL, and any MySQL password stay in env only.
5. Verify UI visually before reporting success.
6. Verify data freshness from `/api/health`, bridge sync time, and at least one leaderboard.
