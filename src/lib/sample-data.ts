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
  { title: "Overall MVP", metric: "Score", field: "score", suffix: "pts", category: "Overall", tone: "emerald", roast: "best all-around menace" },
  { title: "Richest Miner", metric: "Diamonds", field: "diamonds", suffix: "💎", category: "Mining", tone: "cyan", roast: "hoarding the shiny stuff" },
  { title: "Tunnel Goblin", metric: "Blocks mined", field: "blocksMined", suffix: "blocks", category: "Mining", tone: "cyan", roast: "digging like rent is due" },
  { title: "Builder Flex", metric: "Blocks placed", field: "blocksPlaced", suffix: "placed", category: "Building", tone: "violet", roast: "turning cubes into personality" },
  { title: "Craft Goblin", metric: "Items crafted", field: "itemsCrafted", suffix: "crafted", category: "Building", tone: "violet", roast: "crafting table is smoking" },
  { title: "Mob Menace", metric: "Mobs killed", field: "mobsKilled", suffix: "kills", category: "Combat", tone: "rose", roast: "public enemy of mobs" },
  { title: "Heavy Hitter", metric: "Damage dealt", field: "damageDealt", suffix: "damage", category: "Combat", tone: "rose", roast: "hands rated E for everyone" },
  { title: "Pain Sponge", metric: "Damage taken", field: "damageTaken", suffix: "damage", category: "Survival", tone: "amber", roast: "armor crying for help" },
  { title: "Untouchable", metric: "Damage taken", field: "damageTaken", suffix: "damage", category: "Survival", tone: "emerald", roast: "dodging problems for once", ascending: true },
  { title: "Death Tax", metric: "Deaths", field: "deaths", suffix: "deaths", category: "Survival", tone: "amber", roast: "somehow still alive", ascending: true },
  { title: "Respawn Regular", metric: "Deaths", field: "deaths", suffix: "deaths", category: "Survival", tone: "rose", roast: "bed spawn working overtime" },
  { title: "Wanderer", metric: "Distance", field: "distanceKm", suffix: "km", category: "Activity", tone: "sky", roast: "allergic to staying home" },
  { title: "Homebody", metric: "Distance", field: "distanceKm", suffix: "km", category: "Activity", tone: "amber", roast: "front porch specialist", ascending: true },
  { title: "Addict Board", metric: "Playtime", field: "playHours", suffix: "played", category: "Activity", tone: "sky", roast: "grass untouched" },
  { title: "Casual Visitor", metric: "Playtime", field: "playHours", suffix: "played", category: "Activity", tone: "emerald", roast: "healthy screen-time propaganda", ascending: true },
  { title: "Food Vacuum", metric: "Food eaten", field: "foodEaten", suffix: "snacks", category: "Activity", tone: "sky", roast: "server fridge destroyer" },
  { title: "Snack Minimalist", metric: "Food eaten", field: "foodEaten", suffix: "snacks", category: "Activity", tone: "emerald", roast: "living off vibes", ascending: true },
  { title: "Ore Accountant", metric: "Diamonds", field: "diamonds", suffix: "💎", category: "Mining", tone: "cyan", roast: "spreadsheeting the sparkle" },
  { title: "Pacifist Watch", metric: "Mobs killed", field: "mobsKilled", suffix: "kills", category: "Combat", tone: "amber", roast: "letting skeletons unionize", ascending: true },
  { title: "Score Underdog", metric: "Score", field: "score", suffix: "pts", category: "Overall", tone: "violet", roast: "comeback arc loading", ascending: true },
] as const;
