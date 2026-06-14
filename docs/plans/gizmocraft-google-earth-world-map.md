# GizmoCraft Google Earth World Map Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a Google Earth/Google Maps style GizmoCraft world map that starts as the existing 3D Earth globe, zooms into increasingly detailed 2D tiles, and can eventually enter a 3D walkaround/spectator view using terrain/build data already discovered by players.

**Architecture:** Keep the live Minecraft server simulation separate from the map cache. A safe server-side collector reads world files and player positions from `gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole`, writes versioned map artifacts under `/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/`, and the existing bridge exposes them through `/api/world-map` and `/public/world-map-artifacts/*`. The dashboard renders these artifacts as an Earth/globe overview, a slippy 2D tile map, and later a 3D chunk/terrain walkaround.

**Tech Stack:** Minecraft region/player files on the server laptop, Node/TypeScript collectors in this repo, bridge Express API, Next.js/React dashboard, Three.js for globe/3D, static PNG/JSON/GeoJSON/mesh artifacts served by the bridge.

---

## Key decisions

1. **Do not try to increase real simulation forever.** GizmoCraft is already `view-distance=32` and `simulation-distance=20`; server-side scripts cannot make vanilla clients render infinite distance.
2. **Do build a shared discovered-world memory.** The server can store all chunks/regions players have caused to be generated/loaded and publish them to every player through the dashboard.
3. **Use progressive detail.** The UI should work like Google Earth:
   - far zoom: Earth/globe with discovered-world patch
   - mid zoom: 2D tile map with region/chunk detail
   - close zoom: high-detail screenshots/heightmap/orthographic terrain tiles
   - future: 3D walkaround using generated meshes or a browser spectator view
4. **Privacy boundaries.** Public map can show terrain/builds and approximate discovered coverage; individual player trails, base labels, and admin annotations stay signed-in/restricted.
5. **No client mod required for dashboard map.** For in-game far rendering, recommend optional client mods like Distant Horizons/Bobby; the server map does not make vanilla Minecraft render far chunks in-game.

---

## Current confirmed server state

- Active host: `gizmo-server`
- Server root: `/home/cisco/minecraft-servers/gizmo-ivan`
- Active world: `gizmo-ivan-dole`
- Current server config:
  - `view-distance=32`
  - `simulation-distance=20`
- Existing bridge artifact folder: `/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/`
- Existing dashboard map endpoint: `/api/world-map`
- Existing bridge artifact public base: `/public/world-map-artifacts`
- Current manifest contract: `docs/minecraft-tracking-map-contract.md`

---

## Phase 1: World memory collector

### Task 1: Add fixture-driven tests for region/chunk coverage indexing

**Objective:** Prove the collector can turn Minecraft region filenames into a stable world coverage index.

**Files:**
- Create: `tests/world-coverage-collector.test.ts`
- Create: `scripts/collector/world-coverage.ts`

**Test cases:**
- `r.0.0.mca` maps to block bounds `0..511`, `0..511`
- `r.-1.2.mca` maps to block bounds `-512..-1`, `1024..1535`
- ignores non-region filenames
- produces deterministic sorted output

**Command:**

```bash
npm test -- --runInBand tests/world-coverage-collector.test.ts
```

Expected: first run fails because collector does not exist.

### Task 2: Implement region coverage scanner

**Objective:** Scan the active overworld region directory and write `coverage.json`.

**Files:**
- Modify: `scripts/collector/world-coverage.ts`
- Create: `scripts/collector/generate-world-coverage.ts`

**Inputs:**

```text
MINECRAFT_SERVER_ROOT=/home/cisco/minecraft-servers/gizmo-ivan
MINECRAFT_WORLD_NAME=gizmo-ivan-dole
MINECRAFT_MAP_ARTIFACTS_DIR=/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map
```

**Output:**

```json
{
  "generatedAt": "ISO timestamp",
  "world": "gizmo-ivan-dole",
  "dimension": "overworld",
  "sourceRegionDir": ".../gizmo-ivan-dole/dimensions/minecraft/overworld/region",
  "viewDistance": 32,
  "simulationDistance": 20,
  "regions": [
    { "id": "0:0", "regionX": 0, "regionZ": 0, "minBlockX": 0, "minBlockZ": 0, "maxBlockX": 511, "maxBlockZ": 511, "updatedAt": "ISO" }
  ],
  "loadedBlockBounds": { "minX": 0, "minZ": 0, "maxX": 511, "maxZ": 511 }
}
```

**Command:**

```bash
MINECRAFT_SERVER_ROOT=/home/cisco/minecraft-servers/gizmo-ivan \
MINECRAFT_WORLD_NAME=gizmo-ivan-dole \
MINECRAFT_MAP_ARTIFACTS_DIR=/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map \
npx tsx scripts/collector/generate-world-coverage.ts
```

### Task 3: Run the collector on `gizmo-server`

**Objective:** Generate the first durable coverage artifact on the server laptop.

**Commands:**

```bash
ssh cisco@gizmo-server 'mkdir -p /home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map'
rsync -av scripts/collector/world-coverage.ts scripts/collector/generate-world-coverage.ts cisco@gizmo-server:/home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/scripts/
ssh cisco@gizmo-server 'cd /home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map && node --version && npm --version'
```

If the server does not have repo dependencies there, run the collector from the repo path on WSL over SSH paths, or package it as plain `.mjs` with no external dependencies.

**Verification:**

```bash
ssh cisco@gizmo-server 'jq ".world, .regions | length" /home/cisco/minecraft-servers/gizmo-ivan/gizmocraft-map/coverage.json'
```

---

## Phase 2: Player-view footprint collector

### Task 4: Store player current/last-known positions

**Objective:** Include each known player’s current/last location so the map can know whose view cone/view disk generated new coverage.

**Data sources:**
- `gizmo-ivan-dole/players/data/*.dat` for player NBT positions if parseable
- bridge stats/usercache for player names/UUIDs
- existing manifest `players` array as fallback

**Output:**

```json
{
  "players": [
    { "uuid": "...", "name": "Gizmeta", "x": 1567, "y": 71, "z": 9948, "dimension": "overworld", "viewRadiusBlocks": 512, "simulationRadiusBlocks": 320, "lastSeenAt": "ISO" }
  ]
}
```

**Implementation note:** if NBT parsing is too heavy initially, use a small Python helper with `nbtlib` or install a Node NBT parser only in the collector workspace, not in the public dashboard runtime.

### Task 5: Generate `view-footprints.geojson`

**Objective:** For every player point, store a circular/square approximation of the area their client/server view distance can cover.

**Rules:**
- view footprint radius = `view-distance * 16` = currently `512` blocks
- simulation footprint radius = `simulation-distance * 16` = currently `320` blocks
- store footprints as polygons or simple bbox features
- merge/append footprints over time; never delete old explored coverage unless the world is reset

**Output:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "kind": "view", "player": "Gizmeta", "radiusBlocks": 512, "seenAt": "ISO" },
      "geometry": { "type": "Polygon", "coordinates": [[[...]]] }
    }
  ]
}
```

---

## Phase 3: Slippy map tile pyramid

### Task 6: Define tile coordinate system

**Objective:** Convert Minecraft X/Z world coordinates into map tiles at zoom levels.

**Recommended scheme:**
- one tile = `256×256` image pixels
- zoom 0 = full discovered bounds in one tile
- zoom N subdivides by powers of two
- keep a stable `origin` based on spawn or loaded bounds so tile URLs do not shift every time the world expands

**Manifest extension:**

```json
{
  "tilePyramid": {
    "scheme": "minecraft-xz-slippy-v1",
    "tileSize": 256,
    "minZoom": 0,
    "maxZoom": 6,
    "origin": { "x": 0, "z": 0 },
    "bounds": { "minX": -1024, "minZ": -512, "maxX": 3583, "maxZ": 11775 },
    "urlTemplate": "/public/world-map-artifacts/tiles/{z}/{x}/{y}.png"
  }
}
```

### Task 7: Produce simple coverage tiles first

**Objective:** Before rendering real terrain, produce low-cost PNG/SVG/JSON tiles showing loaded regions and player-view footprints.

**Approach:**
- Generate vector JSON tiles first if PNG rendering dependencies are not available.
- UI can render region rectangles on canvas/Three.js.
- Later swap in PNG terrain tiles without changing API shape.

### Task 8: Add dashboard 2D zoom mode

**Objective:** On the `/world` page, allow zooming from Earth globe to detailed 2D map.

**Files:**
- Modify: `src/components/world-map-dashboard.tsx`
- Modify: `src/lib/world-map.ts`
- Test: `tests/world-map.test.ts`

**UI:**
- far zoom: existing Earth ball
- click/scroll zoom: transitions to flat 2D map
- show labels: discovered regions, last scan, player positions
- load tiles progressively based on viewport

---

## Phase 4: Terrain/build rendering

### Task 9: Generate orthographic terrain tiles

**Objective:** Convert region/chunk data into top-down terrain/build imagery.

**Options:**
1. Use an existing renderer like BlueMap/Dynmap/squaremap if compatible with the server version.
2. Build a custom lightweight renderer that reads chunk heightmaps/block palettes and paints topmost visible blocks.
3. Use a headless spectator/bot capture path for cinematic detail near active builds.

**Recommendation:** Start with option 1 if version-compatible; otherwise custom topmost-block renderer.

### Task 10: Add increasing detail by zoom

**Objective:** Make map detail increase as the user zooms.

**Levels:**
- zoom 0–2: region coverage + player paths
- zoom 3–5: chunk coverage + simple biome/height colors
- zoom 6–8: top-down block/build colors
- zoom 9+: high-res screenshots/mesh chunks around builds

---

## Phase 5: 3D walkaround

### Task 11: Generate local 3D meshes from selected chunks

**Objective:** When a user zooms close enough, load a bounded set of chunk meshes around the selected coordinate.

**Constraints:**
- never load the whole world as 3D at once
- use low-poly/merged meshes
- cap radius, e.g. 8–16 chunks around selected point
- keep private markers restricted

### Task 12: Browser walkaround mode

**Objective:** Let the dashboard enter a read-only 3D viewer around a selected location.

**UI:**
- button: “Enter 3D view here”
- first-person controls
- labels for public landmarks only
- minimap showing current coordinate

---

## Phase 6: Automation on the server laptop

### Task 13: Create a user systemd timer for collector refresh

**Objective:** Keep map artifacts updated without touching the Minecraft game loop.

**Timer cadence:**
- coverage/player footprint: every 1–5 minutes
- tile rendering: only changed regions, every 5–15 minutes
- heavy 3D mesh generation: manual or nightly

**Files on server:**

```text
~/.config/systemd/user/gizmocraft-map-collector.service
~/.config/systemd/user/gizmocraft-map-collector.timer
```

**Verification:**

```bash
systemctl --user status gizmocraft-map-collector.timer
journalctl --user -u gizmocraft-map-collector.service -n 80 --no-pager
curl -fsS https://gizmocraft-dashboard.vercel.app/api/world-map | jq '.tracking.generatedAt, .tracking.tilePyramid'
```

---

## Acceptance criteria

- `/api/world-map` returns live region coverage, player-view footprints, and a tile-pyramid descriptor.
- `/world` shows the Earth/globe overview and can zoom into a detailed 2D map.
- Explored regions persist as shared world memory even when no player is nearby.
- No server simulation distance increase is required.
- No raw private world paths or secrets are exposed to browsers.
- Player trails/base labels are not public unless explicitly allowed.

---

## Immediate next implementation slice

Build only Phase 1 and the first half of Phase 2:

1. Add `world-coverage.ts` pure helpers with tests.
2. Add `generate-world-coverage.ts` CLI.
3. Run it against `gizmo-server` active world.
4. Extend bridge manifest with `coverage.json` metadata.
5. Show coverage/footprint status in `/world` without changing the existing globe layout.

This gives us a real server-side “world memory” layer immediately, then we iterate into tiles and 3D detail.
