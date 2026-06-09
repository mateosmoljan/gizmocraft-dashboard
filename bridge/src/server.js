import express from "express";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool } from "./mysql.js";
import { syncMinecraftStats } from "./sync.js";

const app = express();
const port = Number(process.env.PORT ?? 3020);
const bridgeToken = process.env.MINECRAFT_BRIDGE_TOKEN;
const APP_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const serverRoot = process.env.MINECRAFT_SERVER_ROOT ?? "/home/cisco/minecraft-servers/gizmo-ivan";
const execFileAsync = promisify(execFile);
let activeSyncPromise = null;

app.use(express.json({ limit: "1mb" }));

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
  const [onlineRows] = await db.query("SELECT COUNT(*) online FROM users WHERE app_last_seen_at >= ?", [onlineSince]);
  const [totalRows] = await db.query("SELECT COUNT(*) total_signed_in FROM users WHERE email IS NOT NULL AND email <> ''");
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

async function handleProfiles(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 200);
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM players p LEFT JOIN users u ON u.minecraft_uuid=p.uuid
    ORDER BY COALESCE(u.updated_at,p.last_seen_at,p.first_seen_at) DESC LIMIT ?`, [limit]);
  const profiles = [];
  for (const row of rows) profiles.push(await profileForPlayerRow(db, row));
  await db.end();
  res.json({ profiles });
}

async function handleProfileByUsername(req, res) {
  const username = normalizeUsername(req.params.username);
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM players p LEFT JOIN users u ON u.minecraft_uuid=p.uuid
    WHERE u.username=? OR LOWER(p.name)=? LIMIT 1`, [username, username]);
  if (!rows[0]) { await db.end(); return res.status(404).json({ error: "profile not found" }); }
  const profile = await profileForPlayerRow(db, rows[0]);
  await db.end();
  res.json({ profile });
}

async function handleUpdateProfile(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "email required" });
  const username = normalizeUsername(req.body?.username ?? email.split("@")[0]);
  const name = String(req.body?.name ?? username).trim().slice(0, 191) || username;
  const image = req.body?.image ? String(req.body.image) : null;
  const minecraftUuid = req.body?.minecraftUuid ? String(req.body.minecraftUuid) : null;
  const db = await pool();
  const [existingRows] = await db.query("SELECT id FROM users WHERE email=?", [email]);
  if (existingRows[0]) {
    await db.query("UPDATE users SET username=?,name=?,image=?,minecraft_uuid=COALESCE(?,minecraft_uuid),updated_at=NOW(3) WHERE email=?", [username, name, image, minecraftUuid, email]);
  } else {
    await db.query("INSERT INTO users (id,email,username,name,image,minecraft_uuid,role,created_at,updated_at) VALUES (UUID(),?,?,?,?,?,'PLAYER',NOW(3),NOW(3))", [email, username, name, image, minecraftUuid]);
  }
  const [rows] = await db.query(`SELECT p.uuid,p.name AS player_name,p.avatar_url,p.last_seen_at,p.total_play_ms,
      u.id AS user_id,u.username,u.name AS user_name,u.image,u.minecraft_uuid
    FROM users u LEFT JOIN players p ON p.uuid=u.minecraft_uuid WHERE u.email=? LIMIT 1`, [email]);
  const profile = rows[0]?.uuid ? await profileForPlayerRow(db, rows[0]) : { id: rows[0]?.user_id, email, username, name, image, minecraftUuid, player: null };
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
app.put("/api/profile", handleUpdateProfile);
app.put("/profile", handleUpdateProfile);

app.listen(port, "0.0.0.0", () => console.log(`minecraft-dashboard-bridge ready on ${port}`));
