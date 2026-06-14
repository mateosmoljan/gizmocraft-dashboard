# GizmoCraft live Minecraft data contract

This is the source-of-truth checklist for what the dashboard currently reads from the Minecraft server/world so we do not lose track of it.

## Live source

- Host: `gizmo-server`
- Server root: `/home/cisco/minecraft-servers/gizmo-ivan`
- Active world: `gizmo-ivan-dole` from `server.properties` `level-name=gizmo-ivan-dole`
- Stats folder: `/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole/players/stats/*.json`
- Player names: `/home/cisco/minecraft-servers/gizmo-ivan/usercache.json`
- Join/leave sessions: `/home/cisco/minecraft-servers/gizmo-ivan/logs/*.log*`
- Current online players: join/leave state from `/home/cisco/minecraft-servers/gizmo-ivan/logs/latest.log`
- Bridge service: `minecraft-dashboard-bridge.service` on `gizmo-server:3020`
- Production data path: Vercel → authenticated Tailscale Funnel bridge → MySQL + live world files

## Freshness rules

- Production must not show sample leaderboard data when `MINECRAFT_BRIDGE_URL` is configured.
- `/api/public/leaderboards` triggers `POST /api/sync` before reading `/api/leaderboards`.
- Bridge fetches are `cache: "no-store"`; the JSON route is `force-dynamic`, `revalidate = 0`, and returns `cache-control: no-store, max-age=0`.
- If production bridge auth/connectivity fails, the API returns `503` with `live: false` instead of silently serving old sample data.
- Correct live status requires both:
  - `/api/health` → `bridge.connected: true`
  - `/api/public/leaderboards` → `live: true` with a current `worldStats.lastSync`

## Data collected from Minecraft world files

Per player from stats JSON + `usercache.json`:

- `uuid`
- `name`
- `deaths` from `minecraft:custom.minecraft:deaths`
- `mobsKilled` from `minecraft:custom.minecraft:mob_kills`
- `blocksMined` from total `minecraft:mined`
- `diamonds` from mined `minecraft:diamond_ore` + `minecraft:deepslate_diamond_ore`
- `blocksPlaced` from total `minecraft:used`
- `itemsCrafted` from total `minecraft:crafted`
- `foodEaten` from supported food items in `minecraft:used`
- `damageDealt` from `minecraft:custom.minecraft:damage_dealt` / 10
- `damageTaken` from `minecraft:custom.minecraft:damage_taken` / 10
- `distanceKm` from walk + sprint + swim + boat centimeters
- `playHours` from `minecraft:custom.minecraft:play_time`
- `lastSeen` from the latest successful sync write time
- full `raw_stats` JSON stored for future/derived boards

From server logs:

- real Minecraft join times
- real Minecraft leave times
- paired Minecraft world session durations
- overlapping duplicate sessions are merged/upserted
- current online count/player list from latest log open joins

World/sync metadata:

- world display name: `Gizmo Ivan — Dole`
- difficulty label: `Hard Survival`
- tracked player count
- current online player count/list
- latest successful sync time
- sync source path and run status/details in `sync_runs`

## Dashboard boards using that data

- Richest Miner → `diamonds`
- Tunnel Goblin → `blocksMined`
- Mob Menace → `mobsKilled`
- Death Tax → `deaths` ascending
- Wanderer → `distanceKm`
- Addict Board → `playHours`
- Food Vacuum → `foodEaten`
- Builder Flex → `blocksPlaced`
- Craft Goblin → `itemsCrafted`
- Pain Sponge → `damageTaken`

## Profile data connected to Minecraft identities

The bridge combines Minecraft player rows with app/user profile rows:

- public username/display name/image
- linked `minecraftUuid`
- Minecraft player name/avatar/last seen
- total Minecraft playtime
- latest stats snapshot
- recent Minecraft world sessions
- currently online/open session state when present

## Related tracking-map contract

The 3D Earth/dashboard map shell consumes the live-survey/tracking layer described in:

- `docs/minecraft-tracking-map-contract.md`

That layer publishes `tracking` metadata/artifacts through `/api/world-map` and serves image artifacts from `/public/world-map-artifacts/*` when a mapper/survey run has produced `manifest.json`.

## Server diagnostics collected separately

These are server/host telemetry, not world stats:

- host CPU/load
- RAM used/available
- disk used/available for the world path
- network interface and Wi‑Fi/SSID when available
- Minecraft service PID, status, RSS memory, uptime
- current Minecraft online player count/list
