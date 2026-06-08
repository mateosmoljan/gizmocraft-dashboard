import express from "express";
import { pool } from "./mysql.js";
import { syncMinecraftStats } from "./sync.js";

const app = express();
const port = Number(process.env.PORT ?? 3020);
const bridgeToken = process.env.MINECRAFT_BRIDGE_TOKEN;

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

async function handleSync(_req, res) {
  try { res.json(await syncMinecraftStats()); }
  catch (err) { res.status(500).json({ status: "error", message: String(err?.message ?? err) }); }
}
app.post("/api/sync", handleSync);
app.post("/sync", handleSync);

async function handleLeaderboards(_req, res) {
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name,p.last_seen_at,s.deaths,s.mobs_killed,s.blocks_mined,s.blocks_placed,s.items_crafted,s.diamonds_mined,s.distance_cm,s.play_ticks,s.raw_stats
    FROM players p JOIN player_stat_snapshots s ON s.id=(SELECT MAX(id) FROM player_stat_snapshots WHERE player_uuid=p.uuid)
    ORDER BY s.diamonds_mined DESC, s.blocks_mined DESC`);
  const [syncRows] = await db.query("SELECT finished_at,status FROM sync_runs ORDER BY id DESC LIMIT 1");
  await db.end();
  const players = rows.map(toPlayer);
  res.json({ world: { name: "Gizmo Ivan — Dole", difficulty: "Hard Survival", trackedPlayers: players.length, lastSync: syncRows[0]?.finished_at ?? null }, players });
}
app.get("/api/leaderboards", handleLeaderboards);
app.get("/leaderboards", handleLeaderboards);

app.listen(port, "0.0.0.0", () => console.log(`minecraft-dashboard-bridge ready on ${port}`));
