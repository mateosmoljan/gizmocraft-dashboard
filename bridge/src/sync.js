import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pool } from "./mysql.js";

const serverRoot = process.env.MINECRAFT_SERVER_ROOT ?? "/home/cisco/minecraft-servers/gizmo-ivan";
const worldName = process.env.MINECRAFT_WORLD_NAME ?? "gizmo-ivan-dole";
const worldPath = path.join(serverRoot, worldName);

function n(obj, key) { return Number(obj?.stats?.["minecraft:custom"]?.[key] ?? 0); }
function mined(raw, block) { return Number(raw?.stats?.["minecraft:mined"]?.[block] ?? 0); }
function total(obj) { return Object.values(obj ?? {}).reduce((a,b)=>a+Number(b),0); }
function statTotal(raw, group) { return total(raw?.stats?.[group]); }
function foodEaten(raw) {
  const used = raw?.stats?.["minecraft:used"] ?? {};
  const foodNames = ["apple", "baked_potato", "beef", "beetroot", "beetroot_soup", "bread", "carrot", "chicken", "chorus_fruit", "cod", "cooked_beef", "cooked_chicken", "cooked_cod", "cooked_mutton", "cooked_porkchop", "cooked_rabbit", "cooked_salmon", "cookie", "dried_kelp", "enchanted_golden_apple", "golden_apple", "golden_carrot", "honey_bottle", "melon_slice", "mushroom_stew", "mutton", "poisonous_potato", "porkchop", "potato", "pufferfish", "pumpkin_pie", "rabbit", "rabbit_stew", "rotten_flesh", "salmon", "spider_eye", "suspicious_stew", "sweet_berries", "glow_berries", "tropical_fish"];
  return foodNames.reduce((sum, item) => sum + Number(used[`minecraft:${item}`] ?? 0), 0);
}

export async function syncMinecraftStats() {
  const db = await pool();
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
      await db.execute("INSERT INTO players (uuid,name,first_seen_at,last_seen_at) VALUES (?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), last_seen_at=NOW()", [row.uuid, row.name]);
      await db.execute("INSERT INTO player_stat_snapshots (player_uuid,deaths,mobs_killed,blocks_mined,blocks_placed,items_crafted,diamonds_mined,distance_cm,play_ticks,raw_stats) VALUES (?,?,?,?,?,?,?,?,?,CAST(? AS JSON))", [row.uuid,row.deaths,row.mobsKilled,row.blocksMined,row.blocksPlaced,row.itemsCrafted,row.diamondsMined,row.distanceCm,row.playTicks,JSON.stringify(row.raw)]);
      players.push(row);
    }
    await db.execute("UPDATE sync_runs SET status='ok', finished_at=NOW(), details=CAST(? AS JSON) WHERE id=?", [JSON.stringify({ players: players.length, startedAt: started.toISOString() }), runId]);
    await db.end();
    return { status: "ok", source: worldPath, players: players.map(({raw, ...p})=>p) };
  } catch (err) {
    await db.execute("UPDATE sync_runs SET status='error', finished_at=NOW(), details=CAST(? AS JSON) WHERE id=?", [JSON.stringify({ message: String(err?.message ?? err) }), runId]).catch(()=>{});
    await db.end();
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) syncMinecraftStats().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e); process.exit(1);});
