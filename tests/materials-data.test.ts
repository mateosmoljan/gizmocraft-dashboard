import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { materialById, minecraftMaterials, recipesForMaterial, searchMaterials, usedInForMaterial } from "../src/lib/minecraft-materials";

describe("minecraft materials data", () => {
  it("contains generated craftable items, gathered root materials, recipes, and real icon paths", () => {
    assert.ok(minecraftMaterials.stats.items > 1400);
    assert.ok(minecraftMaterials.stats.recipes > 1500);
    const craftingTable = materialById.get("crafting_table");
    assert.ok(craftingTable);
    assert.match(craftingTable.icon, /^\/minecraft-icons\/.+\.png$/);
    assert.ok(recipesForMaterial("crafting_table").length > 0);
    assert.ok(usedInForMaterial("stick").some((item) => item.id === "ladder" || item.id === "torch"));
    const ancientDebris = materialById.get("ancient_debris");
    assert.ok(ancientDebris);
    assert.equal(ancientDebris.craftable, false);
    assert.ok(ancientDebris.source.territories.includes("Nether"));
    assert.match(ancientDebris.source.summary, /Nether/);
  });

  it("supports structured and smart/fuzzy search terms", () => {
    assert.ok(searchMaterials({ query: "diamond gear" }).some((item) => item.id.includes("diamond")));
    assert.ok(searchMaterials({ query: "bright base light" }).some((item) => ["torch", "lantern", "soul_lantern"].includes(item.id)));
    assert.ok(searchMaterials({ query: "crft tbl" }).some((item) => item.id === "crafting_table"));
    assert.ok(searchMaterials({ station: "Stonecutter" }).every((item) => item.stations.includes("Stonecutter")));
  });

  it("renders the page as an icon-first atlas with hover recipe previews and click-to-detail scrolling", () => {
    const source = readFileSync("src/components/materials-dashboard.tsx", "utf8");
    assert.match(source, /Material atlas/);
    assert.match(source, /SourcePopover/);
    assert.match(source, /Where to find/);
    assert.match(source, /scrollIntoView/);
    assert.match(source, /aria-label=\{`Select \$\{item\.name\}`\}/);
  });
});
