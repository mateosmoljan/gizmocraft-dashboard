import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";


const serverRoot = process.env.MINECRAFT_SERVER_ROOT ?? "/home/cisco/minecraft-servers/gizmo-ivan";
const worldName = process.env.MINECRAFT_WORLD_NAME ?? "gizmo-ivan-dole";
const worldPath = path.join(serverRoot, worldName);
const gunzipAsync = promisify(gunzip);
const FARM_ALERT_COOLDOWN_MINUTES = Number(process.env.GIZMOCRAFT_FARM_ALERT_COOLDOWN_MINUTES ?? 30);
const FARM_ALERT_MIN_PLAY_MINUTES = Number(process.env.GIZMOCRAFT_FARM_ALERT_MIN_PLAY_MINUTES ?? 5);

function n(obj, key) { return Number(obj?.stats?.["minecraft:custom"]?.[key] ?? 0); }
function mined(raw, block) { return Number(raw?.stats?.["minecraft:mined"]?.[block] ?? 0); }
function total(obj) { return Object.values(obj ?? {}).reduce((a,b)=>a+Number(b),0); }
function statTotal(raw, group) { return total(raw?.stats?.[group]); }
function foodEaten(raw) {
  const used = raw?.stats?.["minecraft:used"] ?? {};
  const foodNames = ["apple", "baked_potato", "beef", "beetroot", "beetroot_soup", "bread", "carrot", "chicken", "chorus_fruit", "cod", "cooked_beef", "cooked_chicken", "cooked_cod", "cooked_mutton", "cooked_porkchop", "cooked_rabbit", "cooked_salmon", "cookie", "dried_kelp", "enchanted_golden_apple", "golden_apple", "golden_carrot", "honey_bottle", "melon_slice", "mushroom_stew", "mutton", "poisonous_potato", "porkchop", "potato", "pufferfish", "pumpkin_pie", "rabbit", "rabbit_stew", "rotten_flesh", "salmon", "spider_eye", "suspicious_stew", "sweet_berries", "glow_berries", "tropical_fish"];
  return foodNames.reduce((sum, item) => sum + Number(used[`minecraft:${item}`] ?? 0), 0);
}
function rawStats(row) {
  if (!row?.raw_stats) return {};
  if (typeof row.raw_stats === "string") {
    try { return JSON.parse(row.raw_stats); } catch { return {}; }
  }
  return row.raw_stats;
}
function metricDelta(current, previous, reader) {
  return Math.max(0, Number(reader(current) ?? 0) - Number(reader(previous) ?? 0));
}
function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}
export function detectFarmBehavior(currentRow, previousSnapshot, capturedAt = new Date()) {
  if (!previousSnapshot) return [];
  const current = currentRow.raw ?? rawStats(currentRow);
  const previous = rawStats(previousSnapshot);
  const playDeltaTicks = metricDelta(current, previous, (raw) => n(raw, "minecraft:play_time"));
  const playMinutes = playDeltaTicks / 20 / 60;
  if (!Number.isFinite(playMinutes) || playMinutes < FARM_ALERT_MIN_PLAY_MINUTES) return [];

  const deltas = {
    blocksMined: metricDelta(current, previous, (raw) => statTotal(raw, "minecraft:mined")),
    blocksPlaced: metricDelta(current, previous, (raw) => statTotal(raw, "minecraft:used")),
    itemsCrafted: metricDelta(current, previous, (raw) => statTotal(raw, "minecraft:crafted")),
    mobKills: metricDelta(current, previous, (raw) => n(raw, "minecraft:mob_kills")),
    diamondsMined: metricDelta(current, previous, (raw) => mined(raw, "minecraft:diamond_ore") + mined(raw, "minecraft:deepslate_diamond_ore")),
    distanceCm: metricDelta(current, previous, (raw) => n(raw, "minecraft:walk_one_cm") + n(raw, "minecraft:sprint_one_cm") + n(raw, "minecraft:swim_one_cm") + n(raw, "minecraft:boat_one_cm")),
  };
  const hours = playMinutes / 60;
  const rates = {
    blocksMinedPerHour: deltas.blocksMined / hours,
    blocksPlacedPerHour: deltas.blocksPlaced / hours,
    itemsCraftedPerHour: deltas.itemsCrafted / hours,
    mobKillsPerHour: deltas.mobKills / hours,
    diamondsPerHour: deltas.diamondsMined / hours,
    distanceMPerMinute: (deltas.distanceCm / 100) / playMinutes,
  };
  const base = {
    playerUuid: currentRow.uuid,
    playerName: currentRow.name,
    capturedAt: capturedAt instanceof Date ? capturedAt.toISOString() : new Date(capturedAt).toISOString(),
    playMinutes: round(playMinutes),
    deltas,
    rates: Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, round(value)])),
  };
  const alerts = [];
  if (rates.mobKillsPerHour >= 600 && rates.distanceMPerMinute < 35) {
    alerts.push({ ...base, category: "possible_xp_mob_farm", severity: rates.mobKillsPerHour >= 1200 ? "high" : "medium", reason: `${currentRow.name} killed ${deltas.mobKills} mobs in ${round(playMinutes)} min with low travel movement.` });
  }
  if (rates.blocksMinedPerHour >= 3600) {
    alerts.push({ ...base, category: "possible_mining_grind", severity: rates.blocksMinedPerHour >= 7200 ? "high" : "medium", reason: `${currentRow.name} mined ${deltas.blocksMined} blocks in ${round(playMinutes)} min.` });
  }
  if (rates.diamondsPerHour >= 90 && deltas.diamondsMined >= 12) {
    alerts.push({ ...base, category: "possible_ore_saturation", severity: "medium", reason: `${currentRow.name} mined ${deltas.diamondsMined} diamond ore blocks in ${round(playMinutes)} min.` });
  }
  if (rates.blocksPlacedPerHour >= 2400 || rates.itemsCraftedPerHour >= 2400) {
    alerts.push({ ...base, category: "possible_mass_build_or_craft", severity: "low", reason: `${currentRow.name} placed/crafted at a very high rate for ${round(playMinutes)} min.` });
  }
  return alerts;
}
async function sendFarmAlertNotification(alert) {
  const webhookUrl = process.env.GIZMOCRAFT_ALERT_WEBHOOK_URL;
  const text = [`GizmoCraft ${alert.severity} alert: ${alert.category}`, alert.reason, `Window: ${alert.playMinutes} min`, `Player: ${alert.playerName}`].join("\n");
  if (webhookUrl) {
    await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, alert }) }).catch((error) => console.warn("Farm alert webhook failed", error));
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.GIZMOCRAFT_ALERT_FROM || "GizmoCraft <alerts@resend.dev>",
        to: process.env.GIZMOCRAFT_ALERT_EMAIL || process.env.NEW_USER_NOTIFY_EMAIL || "sudodosu99@gmail.com",
        subject: `GizmoCraft ${alert.severity} farm alert: ${alert.playerName}`,
        text,
      }),
    }).catch((error) => console.warn("Farm alert email failed", error));
  }
}
async function ensureWorldEventsTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS world_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(191) NOT NULL,
    player_uuid VARCHAR(36) NULL,
    message TEXT NOT NULL,
    occurred_at DATETIME(3) NOT NULL,
    raw JSON NULL,
    INDEX world_events_type_occurred_at_idx (type, occurred_at),
    INDEX world_events_player_uuid_idx (player_uuid)
  )`);
}
async function recordFarmAlerts(db, alerts) {
  let inserted = 0;
  for (const alert of alerts) {
    const [recentRows] = await db.execute(
      `SELECT id FROM world_events
       WHERE type='farm_alert' AND player_uuid=? AND message LIKE ?
       AND occurred_at >= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
       LIMIT 1`,
      [alert.playerUuid, `%${alert.category}%`, FARM_ALERT_COOLDOWN_MINUTES],
    );
    if (recentRows[0]) continue;
    const message = `[${alert.category}] ${alert.reason}`;
    await db.execute("INSERT INTO world_events (type,player_uuid,message,occurred_at,raw) VALUES (?,?,?,?,CAST(? AS JSON))", ["farm_alert", alert.playerUuid, message, alert.capturedAt, JSON.stringify(alert)]);
    inserted += 1;
    await sendFarmAlertNotification(alert);
  }
  return inserted;
}
function normalizeUsername(value) {
  const username = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return username || "player";
}
function playerOnlyProfileEmail(uuid) { return `minecraft:${String(uuid ?? "").trim().toLowerCase()}@gizmocraft.local`; }

async function ensurePlayerOnlyUser(db, player) {
  const [linkedRows] = await db.execute("SELECT id FROM users WHERE minecraft_uuid=? LIMIT 1", [player.uuid]);
  if (linkedRows[0]) return false;
  const email = playerOnlyProfileEmail(player.uuid);
  const candidates = [normalizeUsername(player.name), normalizeUsername(`${player.name}-${String(player.uuid).slice(0, 8)}`)];
  for (const username of candidates) {
    try {
      await db.execute(
        `INSERT INTO users (id,email,username,name,minecraft_uuid,role,created_at,updated_at)
         VALUES (UUID(),?,?,?,?, 'PLAYER',NOW(3),NOW(3))`,
        [email, username, player.name, player.uuid],
      );
      return true;
    } catch (error) {
      if (!String(error?.message ?? error).includes("Duplicate")) throw error;
    }
  }
  return false;
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function parseMinecraftSessionEvents(text, baseDate) {
  const base = asDate(baseDate);
  let dayOffset = 0;
  let previousSecondOfDay = -1;
  const events = [];

  for (const line of String(text ?? "").split("\n")) {
    const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\].*?: ([A-Za-z0-9_]{1,16}) (joined|left) the game\b/);
    if (!match) continue;
    const [, hour, minute, second, playerName, action] = match;
    const secondOfDay = Number(hour) * 3600 + Number(minute) * 60 + Number(second);
    if (previousSecondOfDay >= 0 && secondOfDay < previousSecondOfDay) dayOffset += 1;
    previousSecondOfDay = secondOfDay;
    const occurredAt = new Date(Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dayOffset,
      Number(hour),
      Number(minute),
      Number(second),
    ));
    events.push({ playerName, action, occurredAt });
  }

  return events;
}

export function pairMinecraftSessionEvents(events) {
  const open = new Map();
  const sessions = [];
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  for (const event of sorted) {
    const key = event.playerName.toLowerCase();
    if (event.action === "joined") {
      const previousJoin = open.get(key);
      if (previousJoin && event.occurredAt > previousJoin.occurredAt) {
        sessions.push(toSession(previousJoin, event.occurredAt));
      }
      open.set(key, event);
      continue;
    }

    const joined = open.get(key);
    if (!joined || event.occurredAt <= joined.occurredAt) continue;
    sessions.push(toSession(joined, event.occurredAt));
    open.delete(key);
  }

  return sessions;
}

function toSession(joined, leftAt) {
  return {
    playerName: joined.playerName,
    joinedAt: joined.occurredAt,
    leftAt,
    durationMs: leftAt.getTime() - joined.occurredAt.getTime(),
  };
}

async function upsertPlayerSession(db, playerUuid, joinedAt, leftAt, durationMs) {
  const [overlappingRows] = await db.execute(
    `SELECT id FROM player_sessions
     WHERE player_uuid=? AND joined_at <= ? AND COALESCE(left_at, joined_at) >= ?
     ORDER BY joined_at ASC, id ASC`,
    [playerUuid, leftAt, joinedAt],
  );
  const keep = overlappingRows[0];
  if (keep) {
    await db.execute(
      "UPDATE player_sessions SET joined_at=?, left_at=?, duration_ms=? WHERE id=?",
      [joinedAt, leftAt, durationMs, keep.id],
    );
    const duplicateIds = overlappingRows.slice(1).map((row) => row.id);
    if (duplicateIds.length) {
      await db.execute(`DELETE FROM player_sessions WHERE id IN (${duplicateIds.map(() => "?").join(",")})`, duplicateIds);
    }
    return false;
  }

  await db.execute("INSERT INTO player_sessions (player_uuid,joined_at,left_at,duration_ms) VALUES (?,?,?,?)", [playerUuid, joinedAt, leftAt, durationMs]);
  return true;
}

function logBaseDate(fileName, mtime) {
  const namedDate = path.basename(fileName).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const source = namedDate ? `${namedDate[1]}-${namedDate[2]}-${namedDate[3]}T00:00:00Z` : mtime;
  return asDate(source);
}

async function readLogText(file) {
  const buffer = await readFile(file);
  return file.endsWith(".gz") ? String(await gunzipAsync(buffer)) : String(buffer);
}

async function syncServerLogSessions(db) {
  const logsDir = path.join(serverRoot, "logs");
  let files = [];
  try {
    files = (await readdir(logsDir)).filter((file) => file.endsWith(".log") || file.endsWith(".log.gz"));
  } catch {
    return { inserted: 0, files: 0 };
  }

  const events = [];
  for (const file of files.sort()) {
    const fullPath = path.join(logsDir, file);
    const info = await stat(fullPath).catch(() => null);
    const text = await readLogText(fullPath).catch(() => "");
    events.push(...parseMinecraftSessionEvents(text, logBaseDate(file, info?.mtime ?? new Date())));
  }

  const sessions = pairMinecraftSessionEvents(events);
  if (!sessions.length) return { inserted: 0, files: files.length };

  const [playerRows] = await db.execute("SELECT uuid,name FROM players");
  const uuidByName = new Map(playerRows.map((row) => [String(row.name).toLowerCase(), row.uuid]));
  let inserted = 0;

  for (const session of sessions) {
    const playerUuid = uuidByName.get(session.playerName.toLowerCase());
    if (!playerUuid) continue;
    const didInsert = await upsertPlayerSession(db, playerUuid, session.joinedAt, session.leftAt, session.durationMs);
    if (didInsert) inserted += 1;
  }

  return { inserted, files: files.length };
}

async function recordInferredPlayerSession(db, playerUuid, currentPlayTicks, previousSnapshot, capturedAt) {
  const currentTicks = Number(currentPlayTicks ?? 0);
  if (currentTicks <= 0) return;

  const [sessionRows] = await db.execute("SELECT id,left_at,duration_ms FROM player_sessions WHERE player_uuid=? ORDER BY joined_at DESC LIMIT 1", [playerUuid]);
  const latestSession = sessionRows[0];
  const captured = asDate(capturedAt);

  if (!previousSnapshot) {
    // A first snapshot's total play_time is historical lifetime playtime, not a
    // real join/leave window ending at the sync time. Server logs are imported
    // separately when available; without a previous snapshot, do not invent a
    // recent completed session.
    return;
  }

  const previousTicks = Number(previousSnapshot.play_ticks ?? 0);
  const deltaTicks = currentTicks - previousTicks;
  if (deltaTicks <= 0) return;

  const durationMs = deltaTicks * 50;
  const previousCapturedAt = asDate(previousSnapshot.captured_at);
  const joinedAt = new Date(Math.max(previousCapturedAt.getTime(), captured.getTime() - durationMs));
  const previousWindowStart = new Date(previousCapturedAt.getTime() - 10 * 60 * 1000);

  if (latestSession?.left_at && asDate(latestSession.left_at) >= previousWindowStart) {
    await db.execute(
      "UPDATE player_sessions SET left_at=?, duration_ms=COALESCE(duration_ms,0)+? WHERE id=?",
      [captured, durationMs, latestSession.id],
    );
    return;
  }

  await upsertPlayerSession(db, playerUuid, joinedAt, captured, durationMs);
}

export async function syncMinecraftStats() {
  const { pool } = await import("./mysql.js");
  const db = await pool();
  await ensureWorldEventsTable(db);
  await db.execute(
    "UPDATE sync_runs SET status='error', finished_at=NOW(3), details=CAST(? AS JSON) WHERE status='running' AND finished_at IS NULL AND started_at < DATE_SUB(NOW(3), INTERVAL 5 MINUTE)",
    [JSON.stringify({ message: "stale running sync cleaned before new run" })],
  );
  const started = new Date();
  const [run] = await db.execute("INSERT INTO sync_runs (source,status) VALUES (?,?)", [worldPath, "running"]);
  const runId = run.insertId;
  try {
    const cache = JSON.parse(await readFile(path.join(serverRoot, "usercache.json"), "utf8"));
    const names = new Map(cache.map(p => [p.uuid, p.name]));
    const statsDir = path.join(worldPath, "players", "stats");
    const files = (await readdir(statsDir)).filter(f => f.endsWith(".json"));
    const players = [];
    for (const file of files) {
      const uuid = file.replace(/\.json$/, "");
      const raw = JSON.parse(await readFile(path.join(statsDir, file), "utf8"));
      const custom = raw?.stats?.["minecraft:custom"] ?? {};
      const minedStats = raw?.stats?.["minecraft:mined"] ?? {};
      const row = {
        uuid, name: names.get(uuid) ?? uuid,
        deaths: n(raw, "minecraft:deaths"),
        mobsKilled: n(raw, "minecraft:mob_kills"),
        blocksMined: total(minedStats),
        diamondsMined: mined(raw, "minecraft:diamond_ore") + mined(raw, "minecraft:deepslate_diamond_ore"),
        blocksPlaced: statTotal(raw, "minecraft:used"),
        itemsCrafted: statTotal(raw, "minecraft:crafted"),
        foodEaten: foodEaten(raw),
        damageDealt: Math.round(n(raw, "minecraft:damage_dealt") / 10) / 10,
        damageTaken: Math.round(n(raw, "minecraft:damage_taken") / 10) / 10,
        distanceCm: n(raw, "minecraft:walk_one_cm") + n(raw, "minecraft:sprint_one_cm") + n(raw, "minecraft:swim_one_cm") + n(raw, "minecraft:boat_one_cm"),
        playTicks: n(raw, "minecraft:play_time"),
        raw
      };
      const capturedAt = new Date();
      const [previousRows] = await db.execute("SELECT play_ticks,captured_at,raw_stats FROM player_stat_snapshots WHERE player_uuid=? ORDER BY captured_at DESC LIMIT 1", [row.uuid]);
      const farmAlerts = detectFarmBehavior(row, previousRows[0] ?? null, capturedAt);
      await db.execute("INSERT INTO players (uuid,name,first_seen_at,last_seen_at,total_play_ms) VALUES (?,?,NOW(),NOW(),?) ON DUPLICATE KEY UPDATE name=VALUES(name), last_seen_at=NOW(), total_play_ms=VALUES(total_play_ms)", [row.uuid, row.name, row.playTicks * 50]);
      await ensurePlayerOnlyUser(db, row);
      await db.execute("INSERT INTO player_stat_snapshots (player_uuid,deaths,mobs_killed,blocks_mined,blocks_placed,items_crafted,diamonds_mined,distance_cm,play_ticks,raw_stats) VALUES (?,?,?,?,?,?,?,?,?,CAST(? AS JSON))", [row.uuid,row.deaths,row.mobsKilled,row.blocksMined,row.blocksPlaced,row.itemsCrafted,row.diamondsMined,row.distanceCm,row.playTicks,JSON.stringify(row.raw)]);
      const insertedFarmAlerts = await recordFarmAlerts(db, farmAlerts);
      await recordInferredPlayerSession(db, row.uuid, row.playTicks, previousRows[0] ?? null, capturedAt);
      if (insertedFarmAlerts) row.farmAlerts = insertedFarmAlerts;
      players.push(row);
    }
    const logSessions = await syncServerLogSessions(db);
    await db.execute("UPDATE sync_runs SET status='ok', finished_at=NOW(), details=CAST(? AS JSON) WHERE id=?", [JSON.stringify({ players: players.length, startedAt: started.toISOString(), logSessions }), runId]);
    await db.end();
    return { status: "ok", source: worldPath, players: players.map(({raw, ...p})=>p) };
  } catch (err) {
    await db.execute("UPDATE sync_runs SET status='error', finished_at=NOW(), details=CAST(? AS JSON) WHERE id=?", [JSON.stringify({ message: String(err?.message ?? err) }), runId]).catch(()=>{});
    await db.end();
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) syncMinecraftStats().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e); process.exit(1);});
