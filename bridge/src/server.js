import express from "express";
import os from "node:os";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool } from "./mysql.js";
import { syncMinecraftStats } from "./sync.js";

const app = express();
const port = Number(process.env.PORT ?? 3020);
const bridgeToken = process.env.MINECRAFT_BRIDGE_TOKEN;
const APP_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const serverRoot = process.env.MINECRAFT_SERVER_ROOT ?? "/home/cisco/minecraft-servers/gizmo-ivan";
const worldName = process.env.MINECRAFT_WORLD_NAME ?? "gizmo-ivan-dole";
const mapArtifactsDir = process.env.MINECRAFT_MAP_ARTIFACTS_DIR ?? `${serverRoot}/gizmocraft-map`;
const mapManifestPath = process.env.MINECRAFT_MAP_MANIFEST ?? `${mapArtifactsDir}/manifest.json`;
const screenshotsDir = process.env.MINECRAFT_SCREENSHOTS_DIR ?? `${serverRoot}/screenshots`;
const execFileAsync = promisify(execFile);
let activeSyncPromise = null;

app.use(express.json({ limit: "1mb" }));

function allowPublicWorldMap(req, res, next) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
}
app.options("/api/public/world-map", allowPublicWorldMap);
app.options("/public/world-map", allowPublicWorldMap);
app.get("/api/public/world-map", allowPublicWorldMap, handleWorldMap);
app.get("/public/world-map", allowPublicWorldMap, handleWorldMap);
app.use("/public/world-map-artifacts", allowPublicWorldMap, express.static(mapArtifactsDir, {
  fallthrough: true,
  immutable: false,
  maxAge: "15s",
}));

app.use((req, res, next) => {
  if (!bridgeToken) return next();
  const expected = `Bearer ${bridgeToken}`;
  if (req.headers.authorization === expected) return next();
  return res.status(401).json({ error: "unauthorized" });
});

function scalar(row, key) { return Number(row[key] ?? 0); }
function rawStats(row) {
  if (!row.raw_stats) return {};
  if (typeof row.raw_stats === "string") {
    try { return JSON.parse(row.raw_stats); } catch { return {}; }
  }
  return row.raw_stats;
}
function total(obj) { return Object.values(obj ?? {}).reduce((a,b)=>a+Number(b),0); }
function foodEaten(raw) {
  const used = raw?.stats?.["minecraft:used"] ?? {};
  const foodNames = ["apple", "baked_potato", "beef", "beetroot", "beetroot_soup", "bread", "carrot", "chicken", "chorus_fruit", "cod", "cooked_beef", "cooked_chicken", "cooked_cod", "cooked_mutton", "cooked_porkchop", "cooked_rabbit", "cooked_salmon", "cookie", "dried_kelp", "enchanted_golden_apple", "golden_apple", "golden_carrot", "honey_bottle", "melon_slice", "mushroom_stew", "mutton", "poisonous_potato", "porkchop", "potato", "pufferfish", "pumpkin_pie", "rabbit", "rabbit_stew", "rotten_flesh", "salmon", "spider_eye", "suspicious_stew", "sweet_berries", "glow_berries", "tropical_fish"];
  return foodNames.reduce((sum, item) => sum + Number(used[`minecraft:${item}`] ?? 0), 0);
}
function custom(raw, key) { return Number(raw?.stats?.["minecraft:custom"]?.[key] ?? 0); }
function normalizeEmail(value) { return String(value ?? "").trim().toLowerCase(); }
function normalizeUsername(value) {
  const username = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return username || "player";
}
function normalizeMinecraftUsername(value) {
  const cleaned = String(value ?? "").trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(cleaned) ? cleaned : null;
}
function playerOnlyProfileEmail(uuid) { return `minecraft:${String(uuid ?? "").trim().toLowerCase()}@gizmocraft.local`; }
function toNumber(value) { return Number(value ?? 0); }
function bytes(value) { return Number(value ?? 0); }
function humanBytes(value) {
  const number = bytes(value);
  if (!Number.isFinite(number) || number <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1);
  return `${(number / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
function cpuSnapshot() {
  const cpus = os.cpus();
  return cpus.reduce((acc, cpu) => {
    const idle = cpu.times.idle;
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return { idle: acc.idle + idle, total: acc.total + total };
  }, { idle: 0, total: 0 });
}
async function runCommand(command, args = [], timeout = 1500) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout, maxBuffer: 1024 * 128 });
    return String(stdout ?? "").trim();
  } catch {
    return "";
  }
}
async function readServerProperties() {
  try {
    const text = await readFile(`${serverRoot}/server.properties`, "utf8");
    return Object.fromEntries(text.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
      const [key, ...rest] = line.split("=");
      return [key, rest.join("=")];
    }));
  } catch {
    return {};
  }
}
function numberProperty(properties, key) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : null;
}
function chunkArea(distance) {
  return Number.isFinite(distance) ? (distance * 2 + 1) ** 2 : null;
}
function serverSettingsPayload(properties, pendingRestart = false) {
  const viewDistance = numberProperty(properties, "view-distance");
  const simulationDistance = numberProperty(properties, "simulation-distance");
  return {
    live: true,
    checkedAt: new Date().toISOString(),
    propertiesPath: `${serverRoot}/server.properties`,
    viewDistance,
    simulationDistance,
    maxPlayers: numberProperty(properties, "max-players"),
    serverPort: numberProperty(properties, "server-port"),
    pendingRestart,
    effective: {
      viewDiameterChunks: Number.isFinite(viewDistance) ? viewDistance * 2 + 1 : null,
      viewAreaChunksPerPlayer: chunkArea(viewDistance),
      simulationDiameterChunks: Number.isFinite(simulationDistance) ? simulationDistance * 2 + 1 : null,
      simulationAreaChunksPerPlayer: chunkArea(simulationDistance),
    },
    note: pendingRestart ? "server.properties saved; restart Minecraft to apply changed distances" : "live server.properties values",
  };
}
function validateChunkDistance(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 2 || number > 32) throw new Error(`${label} must be an integer from 2 to 32`);
  return number;
}
async function writeServerProperties(updates) {
  const filePath = `${serverRoot}/server.properties`;
  const text = await readFile(filePath, "utf8");
  const seen = new Set();
  const lines = text.split("\n").map((line) => {
    const match = line.match(/^([^#=][^=]*)=(.*)$/);
    if (!match) return line;
    const key = match[1].trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  await writeFile(filePath, lines.join("\n"), "utf8");
  return readServerProperties();
}
const screenshotContentTypes = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
]);
function screenshotId(fileName) {
  return Buffer.from(fileName, "utf8").toString("base64url");
}
function screenshotNameFromId(id) {
  const fileName = Buffer.from(String(id ?? ""), "base64url").toString("utf8");
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return null;
  return fileName;
}
function screenshotExtension(fileName) {
  return String(fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
}
function screenshotContentType(fileName) {
  return screenshotContentTypes.get(screenshotExtension(fileName));
}
function inferScreenshotPlayer(fileName) {
  const stem = String(fileName ?? "").replace(/\.[^.]+$/, "");
  const uploaded = /^([A-Za-z0-9_]{1,16})-\d{4}-\d{2}-\d{2}T/.exec(stem);
  if (uploaded) return uploaded[1];
  const cleaned = stem
    .replace(/^screenshot[-_ ]*/i, "")
    .replace(/^\d{4}[-_]?\d{2}[-_]?\d{2}[T_ -]?\d{2}[._-]?\d{2}[._-]?\d{2}(?:[._-]?\d{1,6})?Z?[-_ ]*/i, "")
    .replace(/[-_ ]*\d{4}[-_]?\d{2}[-_]?\d{2}[T_ -]?\d{2}[._-]?\d{2}[._-]?\d{2}(?:[._-]?\d{1,6})?Z?$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 48) : null;
}
async function listScreenshots() {
  await mkdir(screenshotsDir, { recursive: true });
  const entries = await readdir(screenshotsDir);
  const screenshots = [];
  for (const fileName of entries) {
    const contentType = screenshotContentType(fileName);
    if (!contentType) continue;
    const info = await stat(`${screenshotsDir}/${fileName}`).catch(() => null);
    if (!info?.isFile()) continue;
    const modifiedAt = info.mtime.toISOString();
    screenshots.push({
      id: screenshotId(fileName),
      fileName,
      player: inferScreenshotPlayer(fileName),
      url: `/api/screenshots/${encodeURIComponent(screenshotId(fileName))}`,
      sizeBytes: info.size,
      capturedAt: modifiedAt,
      modifiedAt,
      contentType,
    });
  }
  screenshots.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime() || a.fileName.localeCompare(b.fileName));
  return screenshots.slice(0, 120);
}
async function handleScreenshots(_req, res) {
  try {
    const screenshots = await listScreenshots();
    res.setHeader("cache-control", "no-store, max-age=0");
    res.json({
      live: true,
      checkedAt: new Date().toISOString(),
      source: screenshotsDir,
      screenshots,
      count: screenshots.length,
      note: screenshots.length ? undefined : "No screenshots have reached the server inbox yet.",
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
async function handleScreenshotImage(req, res) {
  const fileName = screenshotNameFromId(req.params.id);
  if (!fileName || !screenshotContentType(fileName)) return res.status(404).json({ error: "screenshot not found" });
  res.setHeader("cache-control", "no-store, max-age=0");
  res.type(screenshotContentType(fileName));
  res.sendFile(fileName, { root: screenshotsDir }, (err) => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).json({ error: "screenshot not found" });
  });
}
async function handleScreenshotUpload(req, res) {
  try {
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0].toLowerCase();
    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : null;
    if (!extension) return res.status(415).json({ error: "Use image/png, image/jpeg, or image/webp" });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "image body required" });
    await mkdir(screenshotsDir, { recursive: true });
    const player = normalizeMinecraftUsername(req.query.player) ?? "unknown";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).slice(2, 8);
    const fileName = `${player}-${stamp}-${random}.${extension}`;
    await writeFile(`${screenshotsDir}/${fileName}`, req.body);
    const screenshots = await listScreenshots();
    res.status(201).json({ ok: true, screenshot: screenshots.find((shot) => shot.fileName === fileName) });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
function parseRegionFileName(fileName) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(String(fileName ?? ""));
  if (!match) return null;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  if (!Number.isInteger(regionX) || !Number.isInteger(regionZ)) return null;
  return { regionX, regionZ };
}
function regionToBlockBounds(regionX, regionZ) {
  const minBlockX = regionX * 512;
  const minBlockZ = regionZ * 512;
  return { minBlockX, minBlockZ, maxBlockX: minBlockX + 511, maxBlockZ: minBlockZ + 511 };
}
async function readWorldSpawn() {
  // Without an NBT dependency, keep spawn at Minecraft's default origin when
  // level.dat cannot be parsed. The globe still expands from the loaded region
  // files around that origin, and this can be upgraded to exact NBT later.
  return { x: 0, z: 0 };
}
async function readRegionDir() {
  const candidates = [
    `${serverRoot}/${worldName}/region`,
    `${serverRoot}/${worldName}/dimensions/minecraft/overworld/region`,
  ];
  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {}
  }
  return candidates[0];
}
async function readTrackingManifest() {
  try {
    const manifest = JSON.parse(await readFile(mapManifestPath, "utf8"));
    return {
      ...manifest,
      publicBaseUrl: "/public/world-map-artifacts",
      manifestPath: mapManifestPath,
      available: true,
    };
  } catch (error) {
    return {
      available: false,
      manifestPath: mapManifestPath,
      status: "not-generated-yet",
      note: "Run the live/player-survey mapper to generate manifest.json and map artifacts.",
    };
  }
}
async function handleWorldMap(_req, res) {
  try {
    const regionDir = await readRegionDir();
    const entries = await readdir(regionDir);
    const regions = [];
    for (const file of entries) {
      const parsed = parseRegionFileName(file);
      if (!parsed) continue;
      const bounds = regionToBlockBounds(parsed.regionX, parsed.regionZ);
      const info = await stat(`${regionDir}/${file}`).catch(() => null);
      regions.push({
        id: `${parsed.regionX}:${parsed.regionZ}`,
        ...parsed,
        ...bounds,
        chunkCount: 1024,
        updatedAt: info?.mtime ? info.mtime.toISOString() : null,
      });
    }
    regions.sort((a, b) => Math.hypot(a.regionX, a.regionZ) - Math.hypot(b.regionX, b.regionZ) || a.regionX - b.regionX || a.regionZ - b.regionZ);
    const loadedBlockBounds = regions.length ? {
      minX: Math.min(...regions.map((region) => region.minBlockX)),
      minZ: Math.min(...regions.map((region) => region.minBlockZ)),
      maxX: Math.max(...regions.map((region) => region.maxBlockX)),
      maxZ: Math.max(...regions.map((region) => region.maxBlockZ)),
    } : null;
    res.json({
      world: {
        name: "Gizmo Ivan — Dole",
        dimension: "overworld",
        spawn: await readWorldSpawn(),
        regionCount: regions.length,
        discoveredChunks: regions.reduce((sum, region) => sum + region.chunkCount, 0),
        loadedBlockBounds,
        lastScan: new Date().toISOString(),
      },
      regions,
      tracking: await readTrackingManifest(),
      live: true,
      visibility: {
        public: ["Spawn origin", "Loaded/discovered region files", "Approximate chunk coverage", "Live scan time"],
        signedIn: ["Player-linked overlays", "Personal discovered path summaries"],
        restricted: ["Individual player trails", "Private base/home markers", "Admin-only annotations"],
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
async function readOnlinePlayersFromLatestLog() {
  const open = await readOpenSessionsFromLatestLog();
  return [...open.keys()].sort((a, b) => a.localeCompare(b));
}
async function readOpenSessionsFromLatestLog() {
  const open = new Map();
  try {
    const text = await readFile(`${serverRoot}/logs/latest.log`, "utf8");
    const base = new Date();
    for (const line of text.split("\n")) {
      const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\].*?: ([A-Za-z0-9_]{1,16}) (joined|left) the game\b/);
      if (!match) continue;
      const [, hour, minute, second, playerName, action] = match;
      if (action === "joined") {
        open.set(playerName, new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), Number(hour), Number(minute), Number(second))));
      } else {
        open.delete(playerName);
      }
    }
  } catch {}
  return open;
}
async function cpuUsagePercent() {
  const start = cpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const end = cpuSnapshot();
  const idle = end.idle - start.idle;
  const total = end.total - start.total;
  return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : null;
}
async function diskUsage() {
  const line = (await runCommand("df", ["-kP", process.env.MINECRAFT_WORLD_DIR ?? process.cwd()])).split("\n").at(-1);
  const parts = line?.trim().split(/\s+/) ?? [];
  const total = Number(parts[1] ?? 0) * 1024;
  const used = Number(parts[2] ?? 0) * 1024;
  const available = Number(parts[3] ?? 0) * 1024;
  return {
    mount: parts[5],
    total: humanBytes(total),
    used: humanBytes(used),
    available: humanBytes(available),
    usedPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : null,
  };
}
async function networkUsage() {
  const defaultRoute = await runCommand("ip", ["route", "show", "default"]);
  const iface = defaultRoute.match(/\bdev\s+(\S+)/)?.[1] ?? null;
  const nmcliWifi = await runCommand("nmcli", ["-t", "-f", "ACTIVE,SSID", "dev", "wifi"]);
  const nmcliStatus = await runCommand("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "dev", "status"]);
  const wifiStatus = nmcliStatus.split("\n").map((line) => line.split(":")).find(([device, type, state]) => (!iface || device === iface) && type === "wifi" && state === "connected");
  const ssid = nmcliWifi.split("\n").map((line) => line.split(":")).find(([active, name]) => active === "yes" && name)?.[1]
    || await runCommand("iwgetid", ["-r"])
    || wifiStatus?.[3]
    || null;
  const operstate = iface ? await runCommand("cat", [`/sys/class/net/${iface}/operstate`]) : "";
  return {
    interface: iface,
    state: operstate || undefined,
    wifi: { ssid, connected: Boolean(ssid || wifiStatus) },
    summary: ssid ? `Wi‑Fi: ${ssid}` : iface ? `Interface: ${iface}` : "Unavailable",
    detail: ssid ? `Connected on ${iface ?? "wireless interface"}` : "No connected Wi‑Fi SSID reported by the server.",
  };
}
async function minecraftUsage() {
  const serviceCandidates = [process.env.MINECRAFT_SERVICE, "minecraft-gizmo-ivan.service", "minecraft"].filter(Boolean);
  let pid = "";
  let service = "";
  for (const candidate of serviceCandidates) {
    pid = await runCommand("systemctl", ["--user", "show", candidate, "--property=MainPID", "--value"]);
    if (!pid || pid === "0") pid = await runCommand("systemctl", ["show", candidate, "--property=MainPID", "--value"]);
    if (pid && pid !== "0") { service = candidate; break; }
  }
  if (!pid || pid === "0") pid = (await runCommand("pgrep", ["-f", "java.*(minecraft|gizmo|server)"]))?.split("\n")[0] ?? "";
  const rssKb = pid ? Number(await runCommand("ps", ["-o", "rss=", "-p", pid])) : 0;
  const uptime = pid ? await runCommand("ps", ["-o", "etime=", "-p", pid]) : "";
  const onlinePlayers = await readOnlinePlayersFromLatestLog();
  return {
    status: pid ? "running" : "unknown",
    process: pid ? `pid ${pid}${service ? ` · ${service}` : ""}` : "not found",
    uptime: uptime || undefined,
    playersOnline: onlinePlayers.length,
    onlinePlayers,
    memory: {
      used: humanBytes(rssKb * 1024),
      percent: os.totalmem() > 0 && rssKb > 0 ? Math.round(((rssKb * 1024) / os.totalmem()) * 1000) / 10 : null,
    },
  };
}
async function handleUsage(_req, res) {
  try {
    const cpuPercent = await cpuUsagePercent();
    const memoryUsed = os.totalmem() - os.freemem();
    const [disk, network, minecraft] = await Promise.all([diskUsage(), networkUsage(), minecraftUsage()]);
    res.json({
      checkedAt: new Date().toISOString(),
      system: {
        host: os.hostname(),
        cpu: { usagePercent: cpuPercent, detail: `${os.cpus().length} cores · load ${os.loadavg().map((value) => value.toFixed(2)).join(" / ")}` },
        memory: { used: humanBytes(memoryUsed), total: humanBytes(os.totalmem()), available: humanBytes(os.freemem()), usedPercent: Math.round((memoryUsed / os.totalmem()) * 1000) / 10 },
        disk,
        network,
      },
      minecraft,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
async function handleServerSettings(_req, res) {
  try {
    res.json(serverSettingsPayload(await readServerProperties(), false));
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
async function handleUpdateServerSettings(req, res) {
  try {
    const updates = {};
    if (req.body?.viewDistance !== undefined) updates["view-distance"] = validateChunkDistance(req.body.viewDistance, "viewDistance");
    if (req.body?.simulationDistance !== undefined) updates["simulation-distance"] = validateChunkDistance(req.body.simulationDistance, "simulationDistance");
    if (!Object.keys(updates).length) return res.status(400).json({ error: "viewDistance or simulationDistance required" });
    const properties = await writeServerProperties(updates);
    res.json(serverSettingsPayload(properties, true));
  } catch (err) {
    res.status(400).json({ error: String(err?.message ?? err) });
  }
}
function toPlayer(row) {
  const raw = rawStats(row);
  return {
    uuid: row.uuid,
    name: row.name,
    deaths: scalar(row, "deaths"),
    mobsKilled: scalar(row, "mobs_killed"),
    blocksMined: scalar(row, "blocks_mined"),
    blocksPlaced: scalar(row, "blocks_placed") || total(raw?.stats?.["minecraft:used"]),
    itemsCrafted: scalar(row, "items_crafted") || total(raw?.stats?.["minecraft:crafted"]),
    diamonds: scalar(row, "diamonds_mined"),
    foodEaten: foodEaten(raw),
    damageDealt: Math.round(custom(raw, "minecraft:damage_dealt") / 10) / 10,
    damageTaken: Math.round(custom(raw, "minecraft:damage_taken") / 10) / 10,
    distanceKm: Math.round(Number(row.distance_cm) / 100000) / 10,
    playHours: Math.round(Number(row.play_ticks) / 20 / 3600 * 100) / 100,
    lastSeen: row.last_seen_at,
  };
}

async function handleHealth(_req, res) {
  try { const db = await pool(); const [rows] = await db.query("SELECT COUNT(*) players FROM players"); await db.end(); res.json({ status: "ok", app: "minecraft-dashboard-bridge", players: rows[0].players }); }
  catch (err) { res.status(500).json({ status: "error", message: String(err?.message ?? err) }); }
}
app.get("/api/health", handleHealth);
app.get("/health", handleHealth);
app.get("/api/usage", handleUsage);
app.get("/usage", handleUsage);
app.get("/api/server-settings", handleServerSettings);
app.get("/server-settings", handleServerSettings);
app.put("/api/server-settings", handleUpdateServerSettings);
app.put("/server-settings", handleUpdateServerSettings);
app.get("/api/screenshots", handleScreenshots);
app.get("/screenshots", handleScreenshots);
app.get("/api/screenshots/:id", handleScreenshotImage);
app.get("/screenshots/:id", handleScreenshotImage);
app.post("/api/screenshots/upload", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "15mb" }), handleScreenshotUpload);
app.post("/screenshots/upload", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "15mb" }), handleScreenshotUpload);
app.get("/api/world-map", handleWorldMap);
app.get("/world-map", handleWorldMap);

async function handleSync(_req, res) {
  try {
    activeSyncPromise ??= syncMinecraftStats().finally(() => { activeSyncPromise = null; });
    res.json(await activeSyncPromise);
  }
  catch (err) { res.status(500).json({ status: "error", message: String(err?.message ?? err) }); }
}
app.post("/api/sync", handleSync);
app.post("/sync", handleSync);

async function handleLeaderboards(_req, res) {
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name,p.last_seen_at,s.deaths,s.mobs_killed,s.blocks_mined,s.blocks_placed,s.items_crafted,s.diamonds_mined,s.distance_cm,s.play_ticks,s.raw_stats
    FROM players p JOIN player_stat_snapshots s ON s.id=(SELECT MAX(id) FROM player_stat_snapshots WHERE player_uuid=p.uuid)
    ORDER BY s.diamonds_mined DESC, s.blocks_mined DESC`);
  const [syncRows] = await db.query("SELECT finished_at,status FROM sync_runs WHERE status='ok' ORDER BY id DESC LIMIT 1");
  await db.end();
  const players = rows.map(toPlayer);
  const [onlinePlayers, properties] = await Promise.all([readOnlinePlayersFromLatestLog(), readServerProperties()]);
  res.json({
    world: {
      name: "Gizmo Ivan — Dole",
      difficulty: "Hard Survival",
      trackedPlayers: players.length,
      playersOnline: onlinePlayers.length,
      onlinePlayers,
      maxPlayers: Number(properties["max-players"] ?? 10),
      lastSync: syncRows[0]?.finished_at ?? null,
    },
    players: players.map((player) => ({ ...player, online: onlinePlayers.includes(player.name) })),
  });
}
app.get("/api/leaderboards", handleLeaderboards);
app.get("/leaderboards", handleLeaderboards);

async function readAppStats(db) {
  const onlineSince = new Date(Date.now() - APP_ONLINE_WINDOW_MS);
  const signedInWhere = "COALESCE(sign_in_count,0)>0";
  const [onlineRows] = await db.query(`SELECT COUNT(*) online FROM users WHERE ${signedInWhere} AND app_last_seen_at >= ?`, [onlineSince]);
  const [totalRows] = await db.query(`SELECT COUNT(*) total_signed_in FROM users WHERE ${signedInWhere}`);
  return { online: Number(onlineRows[0]?.online ?? 0), totalSignedIn: Number(totalRows[0]?.total_signed_in ?? 0), live: true };
}

async function recordAppEvent(db, email, eventType, path = null, raw = null) {
  try {
    await db.query(
      "INSERT INTO app_events (user_email,event_type,path,occurred_at,raw) VALUES (?,?,?,NOW(3),CAST(? AS JSON))",
      [email, eventType, path, JSON.stringify(raw ?? {})],
    );
  } catch (error) {
    // Older live DBs may not have app_events yet; stats must keep working.
    if (!String(error?.message ?? error).includes("app_events")) throw error;
  }
}

async function handleAppStats(_req, res) {
  try {
    const db = await pool();
    const stats = await readAppStats(db);
    await db.end();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}

async function handleAppActivity(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const db = await pool();
    const username = normalizeUsername(req.body?.username ?? email.split("@")[0]);
    const name = String(req.body?.name ?? username).trim().slice(0, 191) || username;
    await db.query(
      `INSERT INTO users (id,email,username,name,role,app_last_seen_at,last_login_at,sign_in_count,created_at,updated_at)
       VALUES (UUID(),?,?,?,'PLAYER',NOW(3),NOW(3),1,NOW(3),NOW(3))
       ON DUPLICATE KEY UPDATE app_last_seen_at=NOW(3), last_login_at=COALESCE(last_login_at,NOW(3)), sign_in_count=GREATEST(sign_in_count,1), updated_at=NOW(3)`,
      [email, username, name],
    );
    await recordAppEvent(db, email, "heartbeat", req.body?.path ?? null, { source: "app-activity" });
    const stats = await readAppStats(db);
    await db.end();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}

function profileForUserRow(row) {
  return {
    id: row.user_id,
    email: row.email ?? null,
    username: row.username,
    name: row.user_name ?? row.username,
    image: row.image ?? null,
    minecraftUuid: row.minecraft_uuid ?? null,
    player: null,
  };
}

async function profileForPlayerRow(db, row) {
  const uuid = row.uuid ?? row.minecraft_uuid;
  const [snapshotRows] = await db.query(`SELECT deaths,mobs_killed,blocks_mined,blocks_placed,items_crafted,diamonds_mined,distance_cm,play_ticks,raw_stats,captured_at
    FROM player_stat_snapshots WHERE player_uuid=? ORDER BY captured_at DESC LIMIT 1`, [uuid]);
  const [sessionRows] = await db.query(`SELECT id,joined_at,left_at,duration_ms FROM player_sessions
    WHERE player_uuid=? ORDER BY joined_at DESC LIMIT 12`, [uuid]);
  const latest = snapshotRows[0] ? toPlayer({ ...row, ...snapshotRows[0] }) : null;
  const username = row.username ?? normalizeUsername(row.user_name ?? row.name ?? row.player_name ?? uuid);
  const openSessions = await readOpenSessionsFromLatestLog();
  const playerName = row.player_name ?? row.name ?? uuid;
  const openJoinedAt = openSessions.get(playerName);
  const sessions = sessionRows.map((session) => ({
    id: String(session.id),
    joinedAt: session.joined_at,
    leftAt: session.left_at,
    durationMs: toNumber(session.duration_ms),
  }));
  if (openJoinedAt && !sessions.some((session) => !session.leftAt)) {
    sessions.unshift({
      id: `open-${uuid}`,
      joinedAt: openJoinedAt,
      leftAt: null,
      durationMs: Date.now() - openJoinedAt.getTime(),
    });
  }
  return {
    id: row.user_id ?? `player-${uuid}`,
    username,
    name: row.user_name ?? row.name ?? row.player_name ?? username,
    image: row.image ?? null,
    minecraftUuid: uuid,
    player: {
      uuid,
      name: playerName,
      avatarUrl: row.avatar_url ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      totalPlayMs: toNumber(row.total_play_ms) || (latest?.playHours ? Math.round(latest.playHours * 60 * 60 * 1000) : 0),
      online: Boolean(openJoinedAt),
      stats: latest,
      snapshots: latest ? [latest] : [],
      sessions,
    },
  };
}

async function ensurePlayerOnlyUser(db, row) {
  const uuid = row.uuid;
  if (!uuid) return;
  const [linkedRows] = await db.query("SELECT id FROM users WHERE minecraft_uuid=? LIMIT 1", [uuid]);
  if (linkedRows[0]) return;
  const email = playerOnlyProfileEmail(uuid);
  const displayName = row.name ?? row.player_name ?? uuid;
  const candidates = [normalizeUsername(displayName), normalizeUsername(`${displayName}-${String(uuid).slice(0, 8)}`)];
  for (const username of candidates) {
    try {
      await db.query(
        `INSERT INTO users (id,email,username,name,image,minecraft_uuid,role,created_at,updated_at)
         VALUES (UUID(),?,?,?,?,?,'PLAYER',NOW(3),NOW(3))`,
        [email, username, displayName, row.avatar_url ?? null, uuid],
      );
      return;
    } catch (error) {
      if (!String(error?.message ?? error).includes("Duplicate")) throw error;
    }
  }
}

async function handleProfiles(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 200);
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM players p LEFT JOIN users u ON u.minecraft_uuid=p.uuid
    ORDER BY COALESCE(u.updated_at,p.last_seen_at,p.first_seen_at) DESC LIMIT ?`, [limit]);
  const profiles = [];
  const seenProfileKeys = new Set();
  for (const row of rows) {
    await ensurePlayerOnlyUser(db, row);
    const [profileRows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid
      FROM players p LEFT JOIN users u ON u.minecraft_uuid=p.uuid WHERE p.uuid=? LIMIT 1`, [row.uuid]);
    const profile = await profileForPlayerRow(db, profileRows[0] ?? row);
    profiles.push(profile);
    seenProfileKeys.add(profile.id);
    if (profile.minecraftUuid) seenProfileKeys.add(profile.minecraftUuid);
  }

  const remaining = Math.max(limit - profiles.length, 0);
  if (remaining > 0) {
    const [userRows] = await db.query(`SELECT u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid,
        p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms
      FROM users u LEFT JOIN players p ON p.uuid=u.minecraft_uuid
      WHERE COALESCE(u.sign_in_count,0)>0
      ORDER BY u.updated_at DESC LIMIT ?`, [limit]);
    for (const row of userRows) {
      if (seenProfileKeys.has(row.user_id) || (row.minecraft_uuid && seenProfileKeys.has(row.minecraft_uuid))) continue;
      const profile = row.uuid ? await profileForPlayerRow(db, row) : profileForUserRow(row);
      profiles.push(profile);
      seenProfileKeys.add(profile.id);
      if (profile.minecraftUuid) seenProfileKeys.add(profile.minecraftUuid);
      if (profiles.length >= limit) break;
    }
  }
  await db.end();
  res.json({ profiles });
}

async function handleProfileByUsername(req, res) {
  const username = normalizeUsername(req.params.username);
  const db = await pool();
  const [rows] = await db.query(`SELECT u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid,
      p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms
    FROM users u LEFT JOIN players p ON p.uuid=u.minecraft_uuid
    WHERE u.username=? OR LOWER(p.name)=? LIMIT 1`, [username, username]);
  if (!rows[0]) { await db.end(); return res.status(404).json({ error: "profile not found" }); }
  const profile = rows[0].uuid ? await profileForPlayerRow(db, rows[0]) : profileForUserRow(rows[0]);
  await db.end();
  res.json({ profile });
}

async function handleProfileForEmail(req, res) {
  const email = normalizeEmail(req.query?.email);
  if (!email) return res.status(400).json({ error: "email required" });
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM users u LEFT JOIN players p ON p.uuid=u.minecraft_uuid WHERE u.email=? LIMIT 1`, [email]);
  if (!rows[0]) { await db.end(); return res.status(404).json({ error: "profile not found" }); }
  const row = rows[0];
  const profile = row.uuid ? await profileForPlayerRow(db, row) : { id: row.user_id, email, username: row.username, name: row.user_name, image: row.image ?? null, minecraftUuid: row.minecraft_uuid ?? null, player: null };
  await db.end();
  res.json({ profile });
}

async function handleUpdateProfile(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email required" });
  const username = normalizeUsername(req.body?.username ?? email.split("@")[0]);
  const name = String(req.body?.name ?? username).trim().slice(0, 191) || username;
  const hasImage = Object.prototype.hasOwnProperty.call(req.body ?? {}, "image");
  const image = hasImage ? (req.body?.image ? String(req.body.image) : null) : undefined;
  const requestedMinecraftName = normalizeMinecraftUsername(req.body?.minecraftUsername);
  let minecraftUuid = req.body?.minecraftUuid ? String(req.body.minecraftUuid) : null;
  const db = await pool();
  if (!minecraftUuid && requestedMinecraftName) {
    const [playerRows] = await db.query("SELECT uuid FROM players WHERE LOWER(name)=LOWER(?) LIMIT 1", [requestedMinecraftName]);
    minecraftUuid = playerRows[0]?.uuid ?? null;
  }
  const [existingRows] = await db.query("SELECT id FROM users WHERE email=?", [email]);
  const syntheticEmail = minecraftUuid ? playerOnlyProfileEmail(minecraftUuid) : null;
  if (existingRows[0]) {
    if (syntheticEmail && syntheticEmail !== email) await db.query("DELETE FROM users WHERE email=?", [syntheticEmail]);
    await db.query("UPDATE users SET username=?,name=?,image=COALESCE(?,image),minecraft_uuid=COALESCE(?,minecraft_uuid),updated_at=NOW(3) WHERE email=?", [username, name, image, minecraftUuid, email]);
  } else if (syntheticEmail) {
    const [syntheticRows] = await db.query("SELECT id FROM users WHERE email=? LIMIT 1", [syntheticEmail]);
    if (syntheticRows[0]) {
      await db.query("UPDATE users SET email=?,username=?,name=?,image=COALESCE(?,image),updated_at=NOW(3) WHERE id=?", [email, username, name, image, syntheticRows[0].id]);
    } else {
      await db.query("INSERT INTO users (id,email,username,name,image,minecraft_uuid,role,created_at,updated_at) VALUES (UUID(),?,?,?,?,?,'PLAYER',NOW(3),NOW(3))", [email, username, name, image ?? null, minecraftUuid]);
    }
  } else {
    await db.query("INSERT INTO users (id,email,username,name,image,minecraft_uuid,role,created_at,updated_at) VALUES (UUID(),?,?,?,?,?,'PLAYER',NOW(3),NOW(3))", [email, username, name, image ?? null, minecraftUuid]);
  }
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.email,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM users u LEFT JOIN players p ON p.uuid=u.minecraft_uuid WHERE u.email=? LIMIT 1`, [email]);
  const profile = rows[0]?.uuid ? await profileForPlayerRow(db, rows[0]) : profileForUserRow(rows[0] ?? { user_id: undefined, email, username, user_name: name, image, minecraft_uuid: minecraftUuid });
  await db.end();
  res.json({ profile });
}

app.get("/api/app-stats", handleAppStats);
app.get("/app-stats", handleAppStats);
app.post("/api/app-activity", handleAppActivity);
app.post("/app-activity", handleAppActivity);

app.get("/api/profiles", handleProfiles);
app.get("/profiles", handleProfiles);
app.get("/api/profiles/:username", handleProfileByUsername);
app.get("/profiles/:username", handleProfileByUsername);
app.get("/api/profile", handleProfileForEmail);
app.get("/profile", handleProfileForEmail);
app.put("/api/profile", handleUpdateProfile);
app.put("/profile", handleUpdateProfile);

app.listen(port, "0.0.0.0", () => console.log(`minecraft-dashboard-bridge ready on ${port}`));
