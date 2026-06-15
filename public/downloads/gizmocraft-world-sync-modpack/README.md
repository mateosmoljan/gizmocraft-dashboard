# GizmoCraft Auto-Installing World Sync + Bliss Shader Pack

This is the public download pack for the GizmoCraft shared-world-map, live tracking, and automatic Bliss Shaders setup.

## What goes where?

Put this client mod file in your Minecraft `mods` folder:

```text
mods/gizmocraft-world-sync-client-0.2.2.jar
```

The client mod now auto-downloads this shader pack into your Minecraft `shaderpacks` folder on launch. The ZIP is also included here for manual fallback:

```text
shaderpacks/Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip
```

Do **not** put these files in `mods`:
- `manifest.json`
- `README.md`
- `shaderpacks/Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip`

Only the `.jar` file belongs in `mods`. The Bliss `.zip` stays zipped and belongs in `shaderpacks`; the v0.2.2 client mod can place it there automatically when the player launches Minecraft.

## Requirements for Bliss Shaders

Bliss is a shader pack, not a normal Fabric mod. To use it, your client needs a shader loader:

- Recommended: Fabric + Iris Shaders + Sodium
- Alternative: OptiFine profile

The GizmoCraft world-sync `.jar` is still the only custom GizmoCraft client mod in this pack.

## How to install it

### Option A — normal Minecraft Launcher / Modrinth / Prism folder

1. Close Minecraft.
2. Open your Minecraft folder:
   - Windows: press `Win + R`, paste `%APPDATA%\.minecraft`, press Enter.
   - macOS: `~/Library/Application Support/minecraft`
   - Linux: `~/.minecraft`
3. If there is no `mods` folder, create one.
4. Put `gizmocraft-world-sync-client-0.2.2.jar` here:
   - Windows: `%APPDATA%\.minecraft\mods\`
   - macOS: `~/Library/Application Support/minecraft/mods/`
   - Linux: `~/.minecraft/mods/`
5. If there is no `shaderpacks` folder, create one.
6. Start a Fabric + Iris/Sodium Minecraft profile that matches GizmoCraft.
7. The v0.2.2 client mod creates `shaderpacks/` and auto-downloads/verifies Bliss Shaders if it is missing.
8. In Minecraft: Options → Video Settings → Shader Packs → choose Bliss.
9. Join GizmoCraft. The sync mod writes cache/status files to `.minecraft/gizmocraft-world-sync/` and sends a live heartbeat every 5 seconds.

### Option B — CurseForge / Modrinth App / Prism Launcher instance

If you use a launcher instance instead of the vanilla `.minecraft` folder:

1. Open the launcher.
2. Find the GizmoCraft instance/profile.
3. Click `Open Folder`, `Open Instance Folder`, or `Folder`.
4. Open/create the `mods` folder inside that instance.
5. Put `gizmocraft-world-sync-client-0.2.2.jar` into that instance `mods` folder.
6. Launch that same instance. The mod auto-downloads/verifies Bliss into that instance `shaderpacks` folder if missing.
7. Select Bliss in the shader pack menu.

Important: do **not** put the mod into `saves`, `resourcepacks`, `shaderpacks`, or the world folder. Client mods go in `mods`; shader packs go in `shaderpacks`.

## What this zip contains today

- `README.md` — these installation notes.
- `manifest.json` — shared map-sync and shader metadata.
- `mods/gizmocraft-world-sync-client-0.2.2.jar` — the Fabric client mod to place in Minecraft `mods`.
- `shaderpacks/Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip` — Bliss Shaders v2.1.2 from Modrinth, leave zipped and place in Minecraft `shaderpacks`.

What the GizmoCraft mod does now:
- Auto-downloads/verifies Bliss Shaders into `.minecraft/shaderpacks/` on client launch if missing.
- Downloads `/api/world-map` on client launch and caches it at `.minecraft/gizmocraft-world-sync/latest-world-map.json`.
- Sends live player position + visited chunk heartbeats to `/api/world-map/telemetry` every 5 seconds while you are in-world.
- Writes `.minecraft/gizmocraft-world-sync/latest-heartbeat.json` so you can confirm the heartbeat ran.

What Bliss does:
- Adds realistic lighting, sky, shadows, fog, and water visuals once enabled through Iris/OptiFine.
- It does not send data to the dashboard and does not change server gameplay.

## Important current status

- This now powers the dashboard live tracking layer.
- This now includes Bliss Shaders v2.1.2 for client visuals and the v0.2.2 mod auto-installs it into `shaderpacks` if missing.
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
