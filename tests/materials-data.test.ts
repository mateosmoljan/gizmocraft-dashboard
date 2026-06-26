import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { materialById, minecraftMaterials, recipesForMaterial, searchMaterials, usedInForMaterial } from "../src/lib/minecraft-materials";

describe("minecraft materials data", () => {
  it("contains generated craftable items, recipes, and real icon paths", () => {
    assert.ok(minecraftMaterials.stats.items > 900);
    assert.ok(minecraftMaterials.stats.recipes > 1500);
    const craftingTable = materialById.get("crafting_table");
    assert.ok(craftingTable);
    assert.match(craftingTable.icon, /^\/minecraft-icons\/.+\.png$/);
    assert.ok(recipesForMaterial("crafting_table").length > 0);
    assert.ok(usedInForMaterial("stick").some((item) => item.id === "ladder" || item.id === "torch"));
  });

  it("supports structured and smart/fuzzy search terms", () => {
    assert.ok(searchMaterials({ query: "diamond gear" }).some((item) => item.id.includes("diamond")));
    assert.ok(searchMaterials({ query: "bright base light" }).some((item) => ["torch", "lantern", "soul_lantern"].includes(item.id)));
    assert.ok(searchMaterials({ query: "crft tbl" }).some((item) => item.id === "crafting_table"));
    assert.ok(searchMaterials({ station: "Stonecutter" }).every((item) => item.stations.includes("Stonecutter")));
  });
});
