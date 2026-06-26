import materialsData from "@/data/minecraft-materials.json";

export type MinecraftIngredient = { name: string; id: string; icon: string };
export type MinecraftRecipe = {
  id: string;
  type: string;
  station: string;
  category: string;
  group: string;
  resultId: string;
  resultName: string;
  count: number;
  icon: string;
  pattern: string[];
  key: Record<string, MinecraftIngredient>;
  ingredients: MinecraftIngredient[];
  extra: Record<string, number | string>;
  aliases: string[];
  search: string;
};
export type MinecraftMaterial = {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  stations: string[];
  types: string[];
  aliases: string[];
  recipeIds: string[];
  usedIn: string[];
  search: string;
};
export type MinecraftMaterialsData = {
  version: string;
  source: string;
  generatedAt: string;
  stats: { recipes: number; items: number; icons: number };
  filters: { types: string[]; stations: string[]; categories: string[] };
  items: MinecraftMaterial[];
  recipes: MinecraftRecipe[];
};

export const minecraftMaterials = materialsData as unknown as MinecraftMaterialsData;
export const materialById = new Map(minecraftMaterials.items.map((item) => [item.id, item]));
export const recipesById = new Map(minecraftMaterials.recipes.map((recipe) => [recipe.id, recipe]));

const STOP_WORDS = new Set(["a", "an", "and", "any", "for", "from", "how", "i", "make", "need", "of", "the", "to", "with", "craft", "crafted", "minecraft", "item", "block"]);

export type MaterialSearchFilters = { query?: string; station?: string; category?: string; type?: string; crafted?: "all" | "crafted" | "uncrafted"; craftedIds?: Set<string> };

function normalizeTerm(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9#\s]+/g, " ").replace(/\s+/g, " ").trim();
}

export function smartSearchTokens(query: string) {
  return normalizeTerm(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function consonantSkeleton(value: string) {
  return normalizeTerm(value).replace(/[aeiou\s]+/g, "");
}

function fuzzyIncludes(haystack: string, token: string) {
  if (haystack.includes(token)) return true;
  if (token.length >= 3 && consonantSkeleton(haystack).includes(consonantSkeleton(token))) return true;
  let index = 0;
  for (const char of token) {
    index = haystack.indexOf(char, index);
    if (index === -1) return false;
    index += 1;
  }
  return token.length >= 4;
}

export function materialSearchScore(item: MinecraftMaterial, query: string) {
  const tokens = smartSearchTokens(query);
  if (tokens.length === 0) return 1;
  const haystack = normalizeTerm([item.search, item.id, item.name, ...item.aliases].join(" "));
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (item.id === token || item.name.toLowerCase() === token) {
      score += 20;
      matched += 1;
    } else if (item.id.includes(token)) {
      score += 12;
      matched += 1;
    } else if (item.name.toLowerCase().includes(token)) {
      score += 10;
      matched += 1;
    } else if (item.aliases.some((alias) => normalizeTerm(alias).includes(token))) {
      score += 7;
      matched += 1;
    } else if (haystack.includes(token)) {
      score += 4;
      matched += 1;
    } else if (fuzzyIncludes(haystack, token)) {
      score += 1;
      matched += 1;
    }
  }
  return matched === tokens.length ? score : 0;
}

export function materialMatchesQuery(item: MinecraftMaterial, query: string) {
  return materialSearchScore(item, query) > 0;
}

export function searchMaterials(filters: MaterialSearchFilters = {}) {
  const craftedIds = filters.craftedIds ?? new Set<string>();
  return minecraftMaterials.items
    .map((item) => ({ item, score: materialSearchScore(item, filters.query ?? "") }))
    .filter(({ item, score }) => {
      if (filters.query && score <= 0) return false;
      if (filters.station && !item.stations.includes(filters.station)) return false;
      if (filters.category && !item.categories.includes(filters.category)) return false;
      if (filters.type && !item.types.includes(filters.type)) return false;
      if (filters.crafted === "crafted" && !craftedIds.has(item.id)) return false;
      if (filters.crafted === "uncrafted" && craftedIds.has(item.id)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(({ item }) => item);
}

export function recipesForMaterial(itemId: string) {
  return minecraftMaterials.recipes.filter((recipe) => recipe.resultId === itemId);
}

export function usedInForMaterial(itemId: string) {
  return (materialById.get(itemId)?.usedIn ?? []).map((id) => materialById.get(id)).filter(Boolean) as MinecraftMaterial[];
}
