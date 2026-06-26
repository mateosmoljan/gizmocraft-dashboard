#!/usr/bin/env python3
"""Generate compact GizmoCraft materials data from the official Minecraft client extraction.

Source extraction lives outside the repo at /home/cisco/minecraft-crafting-guide-build.
This intentionally stores real icons as deduplicated PNG files in public/minecraft-icons
instead of inlining base64 data in the app bundle.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
from collections import Counter, defaultdict

SOURCE_ROOT = pathlib.Path("/home/cisco/minecraft-crafting-guide-build")
RECIPES_DIR = SOURCE_ROOT / "extract" / "data" / "minecraft" / "recipe"
LANG_PATH = SOURCE_ROOT / "extract" / "assets" / "minecraft" / "lang" / "en_us.json"
TEXTURE_ROOT = SOURCE_ROOT / "extract" / "assets" / "minecraft" / "textures"
ITEM_DEF_ROOT = SOURCE_ROOT / "extract" / "assets" / "minecraft" / "items"
MODEL_ROOT = SOURCE_ROOT / "extract" / "assets" / "minecraft" / "models"
ITEM_TAGS = SOURCE_ROOT / "extract" / "data" / "minecraft" / "tags" / "item"
BLOCK_TAGS = SOURCE_ROOT / "extract" / "data" / "minecraft" / "tags" / "block"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_JSON = REPO_ROOT / "src" / "data" / "minecraft-materials.json"
ICON_DIR = REPO_ROOT / "public" / "minecraft-icons"

lang = json.loads(LANG_PATH.read_text()) if LANG_PATH.exists() else {}
_json_cache: dict[pathlib.Path, object | None] = {}
_icon_cache: dict[pathlib.Path, str] = {}

def clean_id(x):
    if isinstance(x, dict):
        x = x.get("id") or x.get("item") or x.get("tag") or str(x)
    if not isinstance(x, str):
        x = str(x)
    return x.replace("minecraft:", "")

def title_from_id(item_id):
    item = clean_id(item_id)
    for key in (f"item.minecraft.{item}", f"block.minecraft.{item}"):
        if key in lang:
            return lang[key]
    return item.replace("_", " ").title()

def pretty_ref(value):
    if value is None:
        return ""
    if isinstance(value, str):
        if value.startswith("#"):
            return "#" + clean_id(value).replace("#", "").replace("_", " ").title()
        return title_from_id(value)
    if isinstance(value, list):
        return " / ".join(pretty_ref(v) for v in value)
    if isinstance(value, dict):
        if "item" in value: return pretty_ref(value["item"])
        if "id" in value: return pretty_ref(value["id"])
        if "tag" in value: return "#" + clean_id(value["tag"]).replace("_", " ").title()
        if "items" in value: return pretty_ref(value["items"])
        return ", ".join(f"{k}: {pretty_ref(v)}" for k, v in value.items())
    return str(value)

def item_key(value):
    if isinstance(value, str):
        return value.replace("#minecraft:", "#").replace("minecraft:", "")
    if isinstance(value, dict):
        for k in ("id", "item", "tag"):
            if k in value:
                return ("#" if k == "tag" else "") + clean_id(value[k])
    return re.sub(r"\W+", "_", str(value)).strip("_")[:32]

def read_json(path):
    path = pathlib.Path(path)
    if path not in _json_cache:
        try:
            _json_cache[path] = json.loads(path.read_text())
        except Exception:
            _json_cache[path] = None
    return _json_cache[path]

def namespace_path(ref, default_dir):
    ref = str(ref or "")
    if ref.startswith("#"):
        return ref
    if ":" in ref:
        ns, name = ref.split(":", 1)
    else:
        ns, name = "minecraft", ref
    if ns != "minecraft":
        return None
    return default_dir / f"{name}.json"

def texture_file_from_ref(ref):
    ref = str(ref or "")
    if ":" in ref:
        ns, name = ref.split(":", 1)
    else:
        ns, name = "minecraft", ref
    if ns != "minecraft" or "/" not in name:
        return None
    path = TEXTURE_ROOT / f"{name}.png"
    return path if path.exists() else None

def resolve_texture_token(token, textures):
    token = str(token or "")
    seen = set()
    while token.startswith("#") and token[1:] in textures and token not in seen:
        seen.add(token)
        token = textures[token[1:]]
    return token

def texture_from_model_ref(model_ref, inherited=None, seen=None):
    inherited = inherited or {}
    seen = seen or set()
    if not model_ref or model_ref in seen:
        return None
    seen.add(model_ref)
    path = namespace_path(model_ref, MODEL_ROOT)
    if not path or not pathlib.Path(path).exists():
        return None
    data = read_json(path) or {}
    textures = dict(inherited)
    textures.update(data.get("textures") or {})
    for key in ("layer0", "texture", "particle", "all", "side", "top", "front"):
        if key in textures:
            tex = texture_file_from_ref(resolve_texture_token(textures[key], textures))
            if tex:
                return tex
    parent = data.get("parent")
    if parent:
        tex = texture_from_model_ref(parent, textures, seen)
        if tex:
            return tex
    for val in textures.values():
        tex = texture_file_from_ref(resolve_texture_token(val, textures))
        if tex:
            return tex
    return None

def collect_model_refs(obj):
    refs = []
    if isinstance(obj, dict):
        if obj.get("type") == "minecraft:model" and isinstance(obj.get("model"), str):
            refs.append(obj["model"])
        if isinstance(obj.get("base"), str):
            refs.append(obj["base"])
        if isinstance(obj.get("model"), str) and obj.get("model").startswith("minecraft:"):
            refs.append(obj["model"])
        for v in obj.values():
            refs.extend(collect_model_refs(v))
    elif isinstance(obj, list):
        for v in obj:
            refs.extend(collect_model_refs(v))
    return refs

def texture_path_from_item_definition(item):
    data = read_json(ITEM_DEF_ROOT / f"{item}.json")
    if not data:
        return None
    for model_ref in collect_model_refs(data):
        tex = texture_from_model_ref(model_ref)
        if tex:
            return tex
    return None

def texture_path_for_id(item_id):
    item = clean_id(item_id).replace("#", "")
    for path in (TEXTURE_ROOT / "item" / f"{item}.png", TEXTURE_ROOT / "block" / f"{item}.png", TEXTURE_ROOT / "item" / f"{item}_item.png"):
        if path.exists():
            return path
    tex = texture_path_from_item_definition(item)
    if tex:
        return tex
    for suffix in ("_button", "_pressure_plate", "_door", "_trapdoor", "_fence", "_fence_gate", "_sign", "_hanging_sign", "_boat", "_chest_boat", "_shelf"):
        if item.endswith(suffix):
            base = item[: -len(suffix)]
            for candidate in (f"{base}_planks", f"{base}_log"):
                path = TEXTURE_ROOT / "block" / f"{candidate}.png"
                if path.exists():
                    return path
    for suffix in ("_slab", "_stairs", "_wall"):
        if item.endswith(suffix):
            tex = texture_path_for_id(item[: -len(suffix)])
            if tex:
                return tex
    return None

def tag_values(tag_name, seen=None):
    seen = seen or set()
    tag = clean_id(tag_name).replace("#", "")
    if tag in seen:
        return []
    seen.add(tag)
    vals = []
    for root in (ITEM_TAGS, BLOCK_TAGS):
        path = root / f"{tag}.json"
        if not path.exists():
            continue
        data = read_json(path) or {}
        for v in data.get("values", []):
            if isinstance(v, dict):
                v = v.get("id") or v.get("value") or ""
            if isinstance(v, str) and v.startswith("#"):
                vals.extend(tag_values(v, seen))
            elif v:
                vals.append(clean_id(v))
    return vals

def texture_path_for(value):
    candidates = []
    if isinstance(value, str):
        candidates.extend(tag_values(value) if value.startswith("#") else [clean_id(value)])
    elif isinstance(value, list):
        for v in value:
            tex = texture_path_for(v)
            if tex:
                return tex
    elif isinstance(value, dict):
        for k in ("id", "item"):
            if k in value:
                candidates.append(clean_id(value[k]))
        if "tag" in value:
            candidates.extend(tag_values(value["tag"]))
        if "items" in value:
            return texture_path_for(value["items"])
    for item in candidates:
        tex = texture_path_for_id(item)
        if tex:
            return tex
    return None

def icon_for(value):
    tex = texture_path_for(value)
    if not tex:
        return ""
    if tex in _icon_cache:
        return _icon_cache[tex]
    digest = hashlib.sha1(tex.read_bytes()).hexdigest()[:12]
    out = ICON_DIR / f"{digest}-{tex.name}"
    out.write_bytes(tex.read_bytes())
    rel = f"/minecraft-icons/{out.name}"
    _icon_cache[tex] = rel
    return rel

def words(value: str):
    return [w for w in re.split(r"[^a-z0-9]+", value.lower()) if w]

def aliases_for(item_id: str, name: str, category: str):
    terms = set(words(item_id) + words(name) + words(category))
    for color in ("white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"):
        if item_id.startswith(color + "_"):
            terms.add(color.replace("_", " "))
            terms.add("color")
            terms.add("dye")
    for material in ("oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "bamboo", "crimson", "warped", "copper", "iron", "gold", "diamond", "netherite", "stone", "deepslate", "wooden"):
        if material in item_id:
            terms.add(material.replace("_", " "))
    if any(k in item_id for k in ("sword", "axe", "pickaxe", "shovel", "hoe", "helmet", "chestplate", "leggings", "boots", "shield")):
        terms.update(["gear", "tool", "armor", "equipment"])
    if any(k in item_id for k in ("stairs", "slab", "wall", "door", "trapdoor", "fence", "glass", "brick", "concrete", "planks")):
        terms.update(["building", "base", "block", "decoration"])
    if any(k in item_id for k in ("torch", "lantern", "lamp", "candle")):
        terms.update(["light", "lighting", "bright"])
    return sorted(terms)

def result_info(data):
    r = data.get("result") or data.get("results") or data.get("output") or {}
    if isinstance(r, str):
        return r, 1
    if isinstance(r, list) and r:
        r = r[0]
    if isinstance(r, dict):
        return r.get("id") or r.get("item") or "unknown", r.get("count", 1)
    return "unknown", 1

def station_for(rtype):
    t = rtype.split(":")[-1]
    if t.startswith("crafting_"):
        return "Crafting Table / Inventory"
    return {
        "smelting": "Furnace",
        "blasting": "Blast Furnace",
        "smoking": "Smoker",
        "campfire_cooking": "Campfire",
        "stonecutting": "Stonecutter",
        "smithing_transform": "Smithing Table",
        "smithing_trim": "Smithing Table",
        "crafting_transmute": "Crafting Table",
    }.get(t, t.replace("_", " ").title())

def ing(value):
    return {"name": pretty_ref(value), "id": item_key(value), "icon": icon_for(value)}

def parse_recipe(path):
    data = json.loads(path.read_text())
    rtype = data.get("type", "minecraft:unknown")
    result_id, count = result_info(data)
    rec = {
        "id": path.stem,
        "type": rtype.split(":")[-1],
        "station": station_for(rtype),
        "category": data.get("category") or data.get("group") or "misc",
        "group": data.get("group", ""),
        "resultId": clean_id(result_id),
        "resultName": title_from_id(result_id),
        "count": count,
        "icon": icon_for(result_id),
        "pattern": [],
        "key": {},
        "ingredients": [],
        "extra": {},
    }
    t = rec["type"]
    if t == "crafting_shaped":
        rec["pattern"] = data.get("pattern", [])
        rec["key"] = {k: ing(v) for k, v in data.get("key", {}).items()}
        ingredient_names = [v["name"] for v in rec["key"].values()]
    elif t == "crafting_shapeless":
        rec["ingredients"] = [ing(v) for v in data.get("ingredients", [])]
        ingredient_names = [v["name"] for v in rec["ingredients"]]
    elif t == "crafting_transmute":
        rec["ingredients"] = [ing(v) for v in (data.get("input"), data.get("material")) if v]
        ingredient_names = [v["name"] for v in rec["ingredients"]]
    elif t in ("smelting", "blasting", "smoking", "campfire_cooking", "stonecutting"):
        v = data.get("ingredient")
        rec["ingredients"] = [ing(v)]
        for k in ("experience", "cookingtime"):
            if k in data:
                rec["extra"][k] = data[k]
        ingredient_names = [pretty_ref(v)]
    elif t.startswith("smithing"):
        vals = [data.get("template"), data.get("base"), data.get("addition")]
        rec["ingredients"] = [ing(v) for v in vals if v]
        ingredient_names = [v["name"] for v in rec["ingredients"]]
    else:
        vals = []
        for k in ("ingredient", "ingredients", "input", "base", "addition", "template", "material"):
            if k in data:
                vals.extend(data[k] if isinstance(data[k], list) else [data[k]])
        rec["ingredients"] = [ing(v) for v in vals]
        ingredient_names = [v["name"] for v in rec["ingredients"]]
    rec["aliases"] = aliases_for(rec["resultId"], rec["resultName"], rec["category"])
    rec["search"] = " ".join([rec["resultName"], rec["resultId"], rec["type"], rec["station"], rec["category"], rec["group"], *ingredient_names, *rec["aliases"]]).lower()
    return rec

def main():
    if not RECIPES_DIR.exists():
        raise SystemExit(f"Missing recipe source: {RECIPES_DIR}")
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for old in ICON_DIR.glob("*.png"):
        old.unlink()
    recipes = [parse_recipe(p) for p in sorted(RECIPES_DIR.glob("*.json"))]
    recipes.sort(key=lambda r: (r["resultName"], r["type"], r["id"]))
    used_in = defaultdict(list)
    for rec in recipes:
        ingredients = list(rec["ingredients"])
        ingredients.extend(rec["key"].values())
        for item in ingredients:
            raw = item.get("id", "")
            used_in[raw.replace("#", "")].append(rec["resultId"])
            for tag_item in tag_values(raw)[:80] if raw.startswith("#") else []:
                used_in[tag_item].append(rec["resultId"])
    items_by_id = {}
    for rec in recipes:
        item = items_by_id.setdefault(rec["resultId"], {
            "id": rec["resultId"],
            "name": rec["resultName"],
            "icon": rec["icon"],
            "categories": sorted({rec["category"]}),
            "stations": sorted({rec["station"]}),
            "types": sorted({rec["type"]}),
            "aliases": rec["aliases"],
            "recipeIds": [],
            "usedIn": [],
            "search": "",
        })
        item["recipeIds"].append(rec["id"])
        item["categories"] = sorted(set(item["categories"]) | {rec["category"]})
        item["stations"] = sorted(set(item["stations"]) | {rec["station"]})
        item["types"] = sorted(set(item["types"]) | {rec["type"]})
    for item in items_by_id.values():
        item["usedIn"] = sorted(set(used_in.get(item["id"], [])))[:100]
        item["search"] = " ".join([item["id"], item["name"], *item["categories"], *item["stations"], *item["types"], *item["aliases"], *item["usedIn"]]).lower()
    out = {
        "version": "26.2",
        "source": "Official Minecraft client data pack recipe/model/tag extraction",
        "generatedAt": "2026-06-26",
        "stats": {
            "recipes": len(recipes),
            "items": len(items_by_id),
            "icons": len(list(ICON_DIR.glob("*.png"))),
        },
        "filters": {
            "types": sorted(Counter(r["type"] for r in recipes)),
            "stations": sorted(Counter(r["station"] for r in recipes)),
            "categories": sorted(Counter(r["category"] for r in recipes)),
        },
        "items": sorted(items_by_id.values(), key=lambda i: i["name"]),
        "recipes": recipes,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({"out": str(OUT_JSON), **out["stats"], "bytes": OUT_JSON.stat().st_size}, indent=2))

if __name__ == "__main__":
    main()
