# GizmoCraft Minecraft tracking map contract

This is the backend contract for the live/player-survey map layer that sits under the dashboard's 3D Earth UI.

## Goal

The dashboard globe is the UI shell. The Minecraft tracking backend provides the world-derived map layer that can be refreshed as players build.

Target loop:

1. Mapper joins or surveys the Minecraft world around a focus player/island.
2. Mapper captures terrain/build data from the current world state.
3. Mapper writes PNG/JSON artifacts plus a `manifest.json`.
4. Bridge exposes the manifest through `/api/world-map` under `tracking` and serves images under `/public/world-map-artifacts/*`.
5. Dashboard renders the artifacts inside the 3D Earth / world map page and refreshes every 15 seconds.

## Optimization / preload model

The map should not make every browser re-download or re-scan the whole world.

- **Server memory:** discovered coverage is stored once on `gizmo-server` in `gizmocraft-map/coverage.json`. This is the shared source of truth that all players benefit from.
- **API cache:** `/api/world-map` returns lightweight JSON metadata and may be cached briefly (`max-age=10`, `s-maxage=15`, `stale-while-revalidate=60`) when live. Manual refresh bypasses this cache.
- **Browser preload:** the `/world` page server-loads initial map data and hydrates the globe immediately instead of starting from a blank client-only fetch.
- **Local fallback:** the browser writes the last successful map into `localStorage` under `gizmocraft:last-world-map:v2`; if the bridge is slow/offline, users keep seeing the last known discovered world.
- **Future tile layer:** terrain/image tiles should use immutable hashed URLs so already loaded tiles are reused by every returning browser. Polling should check small metadata/version JSON, not fetch all tile content again.

This structure matches the desired player-sharing model: when any player explores/loads a region, the backend merges that into shared map memory, and other players can view it later without personally loading that area in-game.

## Bridge paths

Default artifact folder on `gizmo-server`:

```text
/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/
```

Default manifest:

```text
/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/manifest.json
```

Environment overrides:

- `MINECRAFT_MAP_ARTIFACTS_DIR`
- `MINECRAFT_MAP_MANIFEST`

Public bridge artifact URL base:

```text
/public/world-map-artifacts
```

## Manifest schema

```json
{
  "status": "generated",
  "generatedAt": "2026-06-10T18:30:00.000Z",
  "source": "gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole",
  "method": "world-surface-scan-now; later: live-player-bot-survey",
  "focus": { "name": "Gizmeta", "x": 1567, "z": 9948, "radiusBlocks": 320 },
  "bounds": { "minX": 1080, "minZ": 9780, "maxX": 1700, "maxZ": 10320 },
  "players": [
    { "name": "Gizmeta", "uuid": "947b65ff-be0f-4e25-8778-25e53f93e423", "x": 1567, "y": 71, "z": 9948, "role": "focus" }
  ],
  "artifacts": [
    { "id": "isometric", "label": "3D/isometric world survey", "kind": "image", "path": "from3d_01_isometric_world_view.png" },
    { "id": "clean-2d", "label": "2D map derived from survey", "kind": "image", "path": "from3d_02_clean_2d_map.png" }
  ]
}
```

## Live-player bot direction

For true player-perspective mapping, the server must allow a dedicated Microsoft/Minecraft account such as `GizmoMapper` to join. Because the server runs with `online-mode=true`, a fake/offline bot is not enough.

Recommended bot responsibilities:

- join as dedicated mapper account
- start near Gizmeta or a requested coordinate
- move along island perimeter and planned survey grid
- record player-visible chunks/blocks
- capture screenshots/first-person frames
- write current artifact set and manifest
- keep a previous snapshot hash/index to detect new builds

Until that account is wired, the current backend can still publish world-file-derived survey artifacts using the same manifest contract.
