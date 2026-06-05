import express from "express";
import { pool } from "./mysql.js";
import { syncMinecraftStats } from "./sync.js";

const app = express();
const port = Number(process.env.PORT ?? 3020);

function toPlayer(row) {
  return { uuid: row.uuid, name: row.name, deaths: row.deaths, mobsKilled: row.mobs_killed, blocksMined: row.blocks_mined, diamonds: row.diamonds_mined, distanceKm: Math.round(Number(row.distance_cm) / 100000) / 10, playHours: Math.round(Number(row.play_ticks) / 20 / 3600 * 100) / 100, lastSeen: row.last_seen_at };
}

app.get("/api/health", async (_req, res) => {
  try { const db = await pool(); const [rows] = await db.query("SELECT COUNT(*) players FROM players"); await db.end(); res.json({ status: "ok", app: "minecraft-dashboard-bridge", players: rows[0].players }); }
  catch (err) { res.status(500).json({ status: "error", message: String(err?.message ?? err) }); }
});

app.post("/api/sync", async (_req, res) => {
  try { res.json(await syncMinecraftStats()); }
  catch (err) { res.status(500).json({ status: "error", message: String(err?.message ?? err) }); }
});

app.get("/api/leaderboards", async (_req, res) => {
  const db = await pool();
  const [rows] = await db.query(`SELECT p.uuid,p.name,p.last_seen_at,s.deaths,s.mobs_killed,s.blocks_mined,s.diamonds_mined,s.distance_cm,s.play_ticks
    FROM players p JOIN player_stat_snapshots s ON s.id=(SELECT MAX(id) FROM player_stat_snapshots WHERE player_uuid=p.uuid)
    ORDER BY s.diamonds_mined DESC, s.blocks_mined DESC`);
  const [syncRows] = await db.query("SELECT finished_at,status FROM sync_runs ORDER BY id DESC LIMIT 1");
  await db.end();
  const players = rows.map(toPlayer);
  res.json({ world: { name: "Gizmo Ivan — Dole", difficulty: "Hard Survival", trackedPlayers: players.length, lastSync: syncRows[0]?.finished_at ?? null }, players });
});

app.listen(port, "0.0.0.0", () => console.log(`minecraft-dashboard-bridge ready on ${port}`));
