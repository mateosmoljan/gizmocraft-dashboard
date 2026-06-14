# GizmoCraft World Sync Modpack

This is the public download pack for the GizmoCraft shared-world-map + live tracking experience.

## What do I put in the `mods` folder?

Put this file in your Minecraft `mods` folder:

```text
mods/gizmocraft-world-sync-client-0.2.0.jar
```

Do **not** put these files in `mods`:
- `manifest.json`
- `README.md`

Only the `.jar` file belongs in the Minecraft `mods` folder.

## How to install it

### Option A — normal Minecraft Launcher / Modrinth / Prism folder

1. Close Minecraft.
2. Open your Minecraft folder:
   - Windows: press `Win + R`, paste `%APPDATA%\.minecraft`, press Enter.
   - macOS: `~/Library/Application Support/minecraft`
   - Linux: `~/.minecraft`
3. If there is no `mods` folder, create one.
4. Put `gizmocraft-world-sync-client-0.2.0.jar` here:
   - Windows: `%APPDATA%\.minecraft\mods\`
   - macOS: `~/Library/Application Support/minecraft/mods/`
   - Linux: `~/.minecraft/mods/`
5. Start a Fabric modded Minecraft profile that matches GizmoCraft.
6. Join GizmoCraft. The sync mod writes cache/status files to `.minecraft/gizmocraft-world-sync/` and sends a live heartbeat every 5 seconds.

### Option B — CurseForge / Modrinth App / Prism Launcher instance

If you use a launcher instance instead of the vanilla `.minecraft` folder:

1. Open the launcher.
2. Find the GizmoCraft instance/profile.
3. Click `Open Folder`, `Open Instance Folder`, or `Folder`.
4. Open/create the `mods` folder inside that instance.
5. Put `gizmocraft-world-sync-client-0.2.0.jar` into that instance `mods` folder.
6. Launch that same instance.

Important: do **not** put the mod into `saves`, `resourcepacks`, `shaderpacks`, or the world folder. Client mods go in `mods`.

## What this zip contains today

- `README.md` — these installation notes.
- `manifest.json` — shared map-sync metadata.
- `mods/gizmocraft-world-sync-client-0.2.0.jar` — the Fabric client mod to place in Minecraft `mods`.

What it does now:
- Downloads `/api/world-map` on client launch and caches it at `.minecraft/gizmocraft-world-sync/latest-world-map.json`.
- Sends live player position + visited chunk heartbeats to `/api/world-map/telemetry` every 5 seconds while you are in-world.
- Writes `.minecraft/gizmocraft-world-sync/latest-heartbeat.json` so you can confirm the heartbeat ran.

## Important current status

- This now powers the dashboard live tracking layer.
- This does **not** force Minecraft to keep chunks rendered behind you. That disappearing is normal render/view distance behavior.
- It does **not** yet include Distant-Horizons-style far terrain rendering inside Minecraft.

## Sync flow

1. Player joins GizmoCraft with the mod installed.
2. The mod sends live position + visited chunk heartbeats.
3. The GizmoCraft bridge stores shared live telemetry once.
4. The website polls `/api/world-map` and paints live players + visited chunk coverage.

## Endpoints

- Website world page: https://gizmocraft-dashboard.vercel.app/world
- World map API: /api/world-map
- Client telemetry API: /api/world-map/telemetry
