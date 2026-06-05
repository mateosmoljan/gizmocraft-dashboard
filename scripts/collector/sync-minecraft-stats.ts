import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";

const worldPath = process.env.MINECRAFT_WORLD_PATH ?? "/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole";
const dryRun = process.argv.includes("--dry-run");

type UserCacheEntry = { uuid: string; name: string; expiresOn?: string };

function getNumber(obj: any, key: string) { return Number(obj?.stats?.["minecraft:custom"]?.[key] ?? 0); }
function mined(obj: any, block: string) { return Number(obj?.stats?.["minecraft:mined"]?.[block] ?? 0); }

async function main() {
  const serverRoot = path.dirname(worldPath);
  const statsDir = path.join(worldPath, "players", "stats");
  try {
    await access(statsDir);
  } catch {
    if (dryRun) {
      console.log(JSON.stringify({
        source: worldPath,
        dryRun,
        status: "missing-local-world-path",
        message: "Run this collector on gizmo-server or set MINECRAFT_WORLD_PATH to a local fixture/world copy."
      }, null, 2));
      return;
    }
    throw new Error(`Minecraft stats directory not found: ${statsDir}`);
  }
  const cache: UserCacheEntry[] = JSON.parse(await readFile(path.join(serverRoot, "usercache.json"), "utf8"));
  const files = (await readdir(statsDir)).filter((f) => f.endsWith(".json"));
  const players = [];
  for (const file of files) {
    const uuid = file.replace(/\.json$/, "");
    const raw = JSON.parse(await readFile(path.join(statsDir, file), "utf8"));
    const name = cache.find((p) => p.uuid === uuid)?.name ?? uuid;
    const deaths = getNumber(raw, "minecraft:deaths");
    const mobsKilled = getNumber(raw, "minecraft:mob_kills");
    const playTicks = getNumber(raw, "minecraft:play_time");
    const distanceCm = getNumber(raw, "minecraft:walk_one_cm") + getNumber(raw, "minecraft:sprint_one_cm") + getNumber(raw, "minecraft:swim_one_cm") + getNumber(raw, "minecraft:boat_one_cm");
    const diamondsMined = mined(raw, "minecraft:diamond_ore") + mined(raw, "minecraft:deepslate_diamond_ore");
    const blocksMined = Object.values(raw?.stats?.["minecraft:mined"] ?? {}).reduce((a: number, b: any) => a + Number(b), 0);
    players.push({ uuid, name, deaths, mobsKilled, playTicks, distanceCm, diamondsMined, blocksMined });
  }
  console.log(JSON.stringify({ source: worldPath, dryRun, players }, null, 2));
  if (!dryRun) console.log("DB write not enabled yet. Wire Prisma/MySQL after credentials are configured.");
}

main().catch((err) => { console.error(err); process.exit(1); });
