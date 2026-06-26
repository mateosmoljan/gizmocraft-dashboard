"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Cuboid, Hammer, Search, Sparkles } from "lucide-react";
import { materialById, minecraftMaterials, recipesForMaterial, searchMaterials, usedInForMaterial, type MinecraftIngredient, type MinecraftMaterial, type MinecraftRecipe } from "@/lib/minecraft-materials";

type Props = { signedIn: boolean; userName?: string | null };

type CraftedResponse = { crafted: string[]; totalCraftable: number; authenticated: boolean };

function itemIcon(item?: { icon?: string; name?: string }, className = "h-9 w-9") {
  if (item?.icon) {
    return <img src={item.icon} alt="" className={`${className} object-contain [image-rendering:pixelated] drop-shadow-[0_8px_10px_rgba(0,0,0,0.45)]`} loading="lazy" />;
  }
  return <span className="text-xs font-black text-slate-200">{(item?.name ?? "?").slice(0, 2).toUpperCase()}</span>;
}

function IsometricIcon({ item, size = "md", active = false, crafted = false }: { item?: { icon?: string; name?: string }; size?: "sm" | "md" | "lg"; active?: boolean; crafted?: boolean }) {
  const box = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const icon = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <span className={`relative grid ${box} shrink-0 place-items-center overflow-hidden rounded-xl border bg-gradient-to-br from-slate-700/80 via-slate-900 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(0,0,0,0.28)] transition duration-150 group-hover:-translate-y-1 group-hover:scale-110 ${active ? "border-emerald-200 ring-2 ring-emerald-300/50" : "border-slate-500/70"}`}>
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_38%,rgba(0,0,0,0.22)_70%)]" />
      <span className="relative grid aspect-square place-items-center">{itemIcon(item, icon)}</span>
      {crafted ? <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-300 text-slate-950"><Check className="h-3 w-3" /></span> : null}
    </span>
  );
}

function IngredientPill({ ingredient }: { ingredient: MinecraftIngredient }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-200">
      <span className="grid h-7 w-7 place-items-center rounded-lg border border-slate-500/50 bg-slate-800">{itemIcon(ingredient)}</span>
      <span>{ingredient.name}</span>
    </span>
  );
}

function RecipeGrid({ recipe }: { recipe: MinecraftRecipe }) {
  if (!recipe.pattern.length) return null;
  const rows = [...recipe.pattern];
  while (rows.length < 3) rows.push("");
  const slots = rows.flatMap((row) => row.padEnd(3, " ").slice(0, 3).split(""));
  return (
    <div className="grid w-max grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/50 p-2">
      {slots.map((symbol, index) => {
        const ingredient = symbol === " " ? null : recipe.key[symbol];
        return (
          <div key={`${recipe.id}-${index}`} title={ingredient?.name} className={`grid h-12 w-12 place-items-center rounded-xl border bg-slate-800/80 ${ingredient ? "border-slate-500" : "border-slate-700/50 opacity-35"}`}>
            {ingredient ? itemIcon(ingredient) : null}
          </div>
        );
      })}
    </div>
  );
}

function MiniRecipePreview({ item, recipe }: { item: MinecraftMaterial; recipe?: MinecraftRecipe }) {
  if (!recipe) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3">
          <IsometricIcon item={item} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{item.name}</p>
            <p className="text-xs text-slate-400">No generated recipe</p>
          </div>
        </div>
      </div>
    );
  }
  const rows = recipe.pattern.length ? [...recipe.pattern] : [];
  while (rows.length < 3) rows.push("");
  const slots = rows.length ? rows.flatMap((row) => row.padEnd(3, " ").slice(0, 3).split("")) : [];
  const ingredients = recipe.ingredients.length ? recipe.ingredients : Object.values(recipe.key);
  return (
    <div className="w-72 rounded-2xl border border-emerald-300/25 bg-slate-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-black text-white">{item.name}</p>
        <span className="shrink-0 rounded-full bg-emerald-300/12 px-2 py-1 text-[10px] font-bold text-emerald-100">×{recipe.count}</span>
      </div>
      {slots.length ? (
        <div className="grid w-max grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/35 p-1.5">
          {slots.map((symbol, index) => {
            const ingredient = symbol === " " ? null : recipe.key[symbol];
            return <span key={`${recipe.id}-mini-${index}`} className={`grid h-8 w-8 place-items-center rounded-lg border bg-slate-800/90 ${ingredient ? "border-slate-500/70" : "border-slate-700/50 opacity-30"}`}>{ingredient ? itemIcon(ingredient, "h-6 w-6") : null}</span>;
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ingredients.slice(0, 9).map((ingredient, index) => <span key={`${recipe.id}-mini-ing-${index}`} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-500/70 bg-slate-800/90" title={ingredient.name}>{itemIcon(ingredient, "h-6 w-6")}</span>)}
        </div>
      )}
      <p className="mt-2 truncate text-[11px] text-slate-400">{recipe.station}</p>
    </div>
  );
}

function RecipeDetail({ recipe }: { recipe: MinecraftRecipe }) {
  const keyIngredients = Object.values(recipe.key);
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-emerald-300/10 px-2 py-1 font-bold text-emerald-100">{recipe.station}</span>
        <span>{recipe.type.replaceAll("_", " ")}</span>
        <span>·</span>
        <span>{recipe.category}</span>
        <span>·</span>
        <span>makes ×{recipe.count}</span>
      </div>
      <div className="mt-4 flex flex-col gap-4 md:flex-row">
        <RecipeGrid recipe={recipe} />
        <div className="flex flex-1 flex-wrap content-start gap-2">
          {(recipe.ingredients.length ? recipe.ingredients : keyIngredients).map((ingredient, index) => <IngredientPill key={`${recipe.id}-${ingredient.id}-${index}`} ingredient={ingredient} />)}
          {Object.keys(recipe.extra).length ? <pre className="w-full overflow-auto rounded-2xl bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(recipe.extra, null, 2)}</pre> : null}
        </div>
      </div>
    </article>
  );
}

export function MaterialsDashboard({ signedIn, userName }: Props) {
  const [query, setQuery] = useState("");
  const [station, setStation] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [craftedFilter, setCraftedFilter] = useState<"all" | "crafted" | "uncrafted">("all");
  const [selectedId, setSelectedId] = useState(minecraftMaterials.items[0]?.id ?? "");
  const [craftedIds, setCraftedIds] = useState<Set<string>>(new Set());
  const [craftedReady, setCraftedReady] = useState(!signedIn);
  const [pending, startTransition] = useTransition();
  const detailRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/materials/crafted", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`crafted ${res.status}`))))
      .then((data: CraftedResponse) => {
        if (!cancelled) setCraftedIds(new Set(data.crafted));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCraftedReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const filtered = useMemo(() => searchMaterials({ query, station, category, type, crafted: craftedFilter, craftedIds }), [query, station, category, type, craftedFilter, craftedIds]);
  const selected = materialById.get(selectedId) ?? filtered[0] ?? minecraftMaterials.items[0];
  const selectedRecipes = selected ? recipesForMaterial(selected.id) : [];
  const usedIn = selected ? usedInForMaterial(selected.id).slice(0, 24) : [];
  const craftedCount = craftedIds.size;

  useEffect(() => {
    if (filtered.length && !filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  function selectMaterial(item: MinecraftMaterial) {
    setSelectedId(item.id);
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function toggleCrafted(item: MinecraftMaterial) {
    if (!signedIn || pending) return;
    const nextCrafted = !craftedIds.has(item.id);
    const previous = new Set(craftedIds);
    const optimistic = new Set(craftedIds);
    if (nextCrafted) optimistic.add(item.id);
    else optimistic.delete(item.id);
    setCraftedIds(optimistic);
    startTransition(() => {
      fetch("/api/materials/crafted", {
        method: nextCrafted ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`crafted ${res.status}`);
          return res.json() as Promise<CraftedResponse>;
        })
        .then((data) => setCraftedIds(new Set(data.crafted)))
        .catch(() => setCraftedIds(previous));
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-emerald-300/20 bg-slate-950/55 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Official Minecraft {minecraftMaterials.version} data</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Materials & Crafting</h1>
            <p className="mt-3 max-w-3xl text-slate-300">Search structured recipes, materials, stations, tags, ingredients, and smart aliases generated from the official client data. Tracking is per signed-in GizmoCraft user.</p>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/8 p-4">
            <div>
              <p className="text-3xl font-black text-white">{craftedReady ? craftedCount : "—"}</p>
              <p className="text-xs text-slate-400">crafted by {signedIn ? userName ?? "you" : "you"}</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-200">{minecraftMaterials.stats.items}</p>
              <p className="text-xs text-slate-400">craftable outputs</p>
            </div>
            <div className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${Math.min(100, (craftedCount / minecraftMaterials.stats.items) * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_repeat(4,minmax(150px,1fr))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-200" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Smart search: 'bright base light', 'diamond gear', 'red building block', planks…" className="h-full w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-12 pr-4 text-sm text-white outline-none ring-emerald-300/40 focus:ring-2" />
          </label>
          <select value={station} onChange={(event) => setStation(event.target.value)} className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white">
            <option value="">All stations</option>
            {minecraftMaterials.filters.stations.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white">
            <option value="">All categories</option>
            {minecraftMaterials.filters.categories.map((entry) => <option key={entry} value={entry}>{entry.replaceAll("_", " ")}</option>)}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white">
            <option value="">All recipe types</option>
            {minecraftMaterials.filters.types.map((entry) => <option key={entry} value={entry}>{entry.replaceAll("_", " ")}</option>)}
          </select>
          <select value={craftedFilter} onChange={(event) => setCraftedFilter(event.target.value as "all" | "crafted" | "uncrafted")} className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white" disabled={!signedIn}>
            <option value="all">All crafted states</option>
            <option value="crafted">Crafted</option>
            <option value="uncrafted">Not crafted</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <p><Sparkles className="mr-1 inline h-4 w-4 text-emerald-200" />Smart search is structured/fuzzy search over names, IDs, ingredients, tags, stations, colors, and aliases — no image identification yet.</p>
          <button onClick={() => { setQuery(""); setStation(""); setCategory(""); setType(""); setCraftedFilter("all"); }} className="rounded-full border border-white/10 px-4 py-2 font-bold text-slate-200 hover:border-emerald-300/40">Reset</button>
        </div>
      </section>

      {!signedIn ? <div className="rounded-3xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50">Sign in with Google to save a private crafted checklist. Search and recipe browsing still work without tracking.</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-4 backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-white"><Cuboid className="h-4 w-4 text-emerald-200" /> Icon atlas</p>
            <p className="text-xs text-slate-400">Showing {filtered.length.toLocaleString()} of {minecraftMaterials.stats.items.toLocaleString()} materials. Hover an icon for the recipe grid; click an icon to jump to its detail.</p>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-x-2 gap-y-5 md:grid-cols-[repeat(auto-fill,minmax(66px,1fr))]">
          {filtered.map((item, index) => {
            const crafted = craftedIds.has(item.id);
            const active = selected?.id === item.id;
            const firstRecipe = recipesForMaterial(item.id)[0];
            return (
              <button key={item.id} type="button" onClick={() => selectMaterial(item)} title={item.name} aria-label={`Select ${item.name}`} className="group relative isolate flex min-h-20 items-center justify-center rounded-2xl border border-transparent p-1 transition hover:z-30 hover:border-emerald-300/30 hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-emerald-300/60">
                <IsometricIcon item={item} size="md" active={active} crafted={crafted} />
                <span className="sr-only">{item.name}</span>
                <span className={`pointer-events-none absolute left-1/2 z-40 hidden -translate-x-1/2 ${index < 12 ? "top-full mt-3" : "bottom-full mb-3"} group-hover:block group-focus:block`}>
                  <MiniRecipePreview item={item} recipe={firstRecipe} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={detailRef} className="scroll-mt-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 backdrop-blur">
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <IsometricIcon item={selected} size="lg" crafted={craftedIds.has(selected.id)} active />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Selected material</p>
                  <h2 className="mt-1 text-3xl font-black">{selected.name}</h2>
                  <p className="break-all text-sm text-slate-500">{selected.id}</p>
                </div>
              </div>
              <button onClick={() => toggleCrafted(selected)} disabled={!signedIn || pending} className={`inline-flex w-max items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${craftedIds.has(selected.id) ? "bg-emerald-300 text-slate-950" : "border border-white/10 text-slate-200 disabled:opacity-45"}`}>
                <Check className="h-4 w-4" /> {craftedIds.has(selected.id) ? "Crafted" : signedIn ? "Mark as crafted" : "Sign in to track"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[...selected.categories, ...selected.stations, ...selected.types].slice(0, 8).map((entry) => <span key={entry} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{entry.replaceAll("_", " ")}</span>)}
            </div>

            <section>
              <div className="mb-3 flex items-center gap-2 text-lg font-black"><Hammer className="h-5 w-5 text-emerald-200" /> How to craft</div>
              <div className="grid gap-3 xl:grid-cols-2">
                {selectedRecipes.length ? selectedRecipes.map((recipe) => <RecipeDetail key={recipe.id} recipe={recipe} />) : <p className="text-sm text-slate-500">No generated recipe for this material.</p>}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-lg font-black">Used in</h3>
              {usedIn.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {usedIn.map((item) => (
                    <button key={item.id} onClick={() => selectMaterial(item)} className="group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-left text-xs text-slate-200 hover:border-emerald-300/40">
                      <IsometricIcon item={item} size="sm" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No generated recipe uses this as an ingredient.</p>}
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
