#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SCREENSHOTS_DIR = "/mnt/c/Users/Korisnik/AppData/Roaming/.minecraft/screenshots";
const STATE_PATH = `${homedir()}/.local/state/gizmocraft-screenshot-sync.json`;
const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function loadConfig() {
  const localEnv = await readFile(new URL("../.env.local", import.meta.url), "utf8").then(parseEnv).catch(() => ({}));
  const bridgeUrl = process.env.MINECRAFT_BRIDGE_URL || localEnv.MINECRAFT_BRIDGE_URL;
  const token = process.env.MINECRAFT_BRIDGE_TOKEN || localEnv.MINECRAFT_BRIDGE_TOKEN;
  const screenshotsDir = process.env.MINECRAFT_CLIENT_SCREENSHOTS_DIR || localEnv.MINECRAFT_CLIENT_SCREENSHOTS_DIR || DEFAULT_SCREENSHOTS_DIR;
  const player = process.env.MINECRAFT_SCREENSHOT_PLAYER || localEnv.MINECRAFT_SCREENSHOT_PLAYER || "Gizmeta";
  if (!bridgeUrl) throw new Error("MINECRAFT_BRIDGE_URL is required");
  if (!token) throw new Error("MINECRAFT_BRIDGE_TOKEN is required");
  return { bridgeUrl: bridgeUrl.replace(/\/$/, ""), token, screenshotsDir, player };
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { uploaded: {} };
  }
}

async function saveState(state) {
  await mkdir(join(homedir(), ".local/state"), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

function fileKey(file, info) {
  return `${basename(file)}:${info.size}:${Math.round(info.mtimeMs)}`;
}

async function uploadFile(config, file) {
  const extension = extname(file).toLowerCase();
  const contentType = IMAGE_TYPES.get(extension);
  if (!contentType) return false;
  const body = createReadStream(file);
  const url = `${config.bridgeUrl}/api/screenshots/upload?player=${encodeURIComponent(config.player)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": contentType,
    },
    body,
    duplex: "half",
  });
  if (!res.ok) throw new Error(`upload ${basename(file)} returned ${res.status}: ${await res.text()}`);
  return true;
}

async function scanOnce(config, state) {
  const entries = await readdir(config.screenshotsDir).catch(() => []);
  const files = [];
  for (const name of entries) {
    const file = join(config.screenshotsDir, name);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile() || !IMAGE_TYPES.has(extname(name).toLowerCase())) continue;
    files.push({ file, info });
  }
  files.sort((a, b) => a.info.mtimeMs - b.info.mtimeMs);

  let uploaded = 0;
  for (const { file, info } of files) {
    const key = fileKey(file, info);
    if (state.uploaded[key]) continue;
    await uploadFile(config, file);
    state.uploaded[key] = new Date().toISOString();
    uploaded += 1;
  }
  if (uploaded) await saveState(state);
  return uploaded;
}

async function main() {
  const config = await loadConfig();
  const state = await loadState();
  console.log(`Watching ${config.screenshotsDir} for ${config.player} screenshots`);
  if (process.argv.includes("--once")) {
    const uploaded = await scanOnce(config, state);
    console.log(`Uploaded ${uploaded} screenshot(s).`);
    return;
  }
  while (true) {
    try {
      const uploaded = await scanOnce(config, state);
      if (uploaded) console.log(`Uploaded ${uploaded} screenshot(s) at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
