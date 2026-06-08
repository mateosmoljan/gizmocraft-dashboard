export const players = [
  { uuid: "5e8db67a-1249-44dc-a053-713bd8a8844a", name: "GMRooster", avatar: "🐓", score: 3075, deaths: 1, distanceKm: 8.28, playHours: 2.41, mobsKilled: 97, blocksMined: 755, blocksPlaced: 620, itemsCrafted: 180, diamonds: 20, foodEaten: 16, damageDealt: 412, damageTaken: 133, lastSeen: "tracked" },
  { uuid: "947b65ff-be0f-4e25-8778-25e53f93e423", name: "Gizmeta", avatar: "⚡", score: 2318, deaths: 0, distanceKm: 9.43, playHours: 2.17, mobsKilled: 35, blocksMined: 1074, blocksPlaced: 430, itemsCrafted: 210, diamonds: 2, foodEaten: 21, damageDealt: 171, damageTaken: 88, lastSeen: "tracked" },
  { uuid: "1fa45424-66b3-4996-aeb7-089d78bc367c", name: "DjoleArmani", avatar: "🧱", score: 870, deaths: 1, distanceKm: 6.26, playHours: 1.16, mobsKilled: 20, blocksMined: 150, blocksPlaced: 220, itemsCrafted: 95, diamonds: 0, foodEaten: 9, damageDealt: 96, damageTaken: 141, lastSeen: "tracked" },
];

export const worldStats = {
  name: "Gizmo Ivan — Dole",
  difficulty: "Hard Survival",
  playersOnline: 1,
  maxPlayers: 10,
  trackedPlayers: players.length,
  uptime: "live",
  lastSync: "collector not deployed yet",
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
