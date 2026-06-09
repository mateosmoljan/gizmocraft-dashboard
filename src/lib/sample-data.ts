export type SamplePlayer = {
  uuid: string;
  name: string;
  avatar: string;
  score: number;
  deaths: number;
  distanceKm: number;
  playHours: number;
  mobsKilled: number;
  blocksMined: number;
  blocksPlaced: number;
  itemsCrafted: number;
  diamonds: number;
  foodEaten: number;
  damageDealt: number;
  damageTaken: number;
  lastSeen: string;
  online?: boolean;
};

// Intentionally empty: production must not show invented/stale player stats.
// Real values come from the authenticated Minecraft bridge and the last-loaded client cache.
export const players: SamplePlayer[] = [];

export const worldStats = {
  name: "Gizmo Ivan — Dole",
  difficulty: "Hard Survival",
  playersOnline: 0,
  maxPlayers: 10,
  trackedPlayers: 0,
  uptime: "bridge pending",
  lastSync: "waiting for live data",
};

export const boards = [
  { title: "Richest Miner", metric: "Diamonds", field: "diamonds", suffix: "💎", roast: "hoarding the shiny stuff" },
  { title: "Tunnel Goblin", metric: "Blocks mined", field: "blocksMined", suffix: "blocks", roast: "digging like rent is due" },
  { title: "Mob Menace", metric: "Mobs killed", field: "mobsKilled", suffix: "kills", roast: "public enemy of mobs" },
  { title: "Death Tax", metric: "Deaths", field: "deaths", suffix: "deaths", roast: "somehow still alive", ascending: true },
  { title: "Wanderer", metric: "Distance", field: "distanceKm", suffix: "km", roast: "allergic to staying home" },
  { title: "Addict Board", metric: "Playtime", field: "playHours", suffix: "hours", roast: "grass untouched" },
  { title: "Food Vacuum", metric: "Food eaten", field: "foodEaten", suffix: "snacks", roast: "server fridge destroyer" },
  { title: "Builder Flex", metric: "Blocks placed", field: "blocksPlaced", suffix: "placed", roast: "turning cubes into personality" },
  { title: "Craft Goblin", metric: "Items crafted", field: "itemsCrafted", suffix: "crafted", roast: "crafting table is smoking" },
  { title: "Pain Sponge", metric: "Damage taken", field: "damageTaken", suffix: "damage", roast: "armor crying for help" },
] as const;
