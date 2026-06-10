"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
import type { WorldMapData, WorldMapRegion } from "@/lib/world-map";

const CACHE_KEY = "gizmocraft:last-world-map";
const POLL_MS = 15_000;

const emptyMap: WorldMapData = {
  world: {
    name: "Gizmo Ivan — Dole",
    dimension: "overworld",
    spawn: { x: 0, z: 0 },
    regionCount: 0,
    discoveredChunks: 0,
    loadedBlockBounds: null,
    lastScan: "waiting for live scan",
  },
  regions: [],
  tracking: {
    available: false,
    status: "waiting-for-mapper",
    note: "Minecraft tracking backend has not published a map manifest yet.",
  },
  live: false,
  visibility: {
    public: ["Spawn origin", "Discovered region coverage", "Live scan time"],
    signedIn: ["Profile-linked overlays"],
    restricted: ["Private markers and player trails"],
  },
};

function format(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function blockToSphere(x: number, z: number, bounds: NonNullable<WorldMapData["world"]["loadedBlockBounds"]>, radius = 2.04) {
  const width = Math.max(1, bounds.maxX - bounds.minX + 1);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ + 1);
  const lon = ((x - bounds.minX) / width - 0.5) * Math.PI * 1.65;
  const lat = (0.5 - (z - bounds.minZ) / depth) * Math.PI * 0.9;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function regionCenter(region: WorldMapRegion) {
  return {
    x: (region.minBlockX + region.maxBlockX) / 2,
    z: (region.minBlockZ + region.maxBlockZ) / 2,
  };
}

function latLonToSphere(lat: number, lon: number, radius = 2.045) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

const visibleLandPatches = [
  { lat: 45, lon: -100, size: 0.34 },
  { lat: -15, lon: -60, size: 0.42 },
  { lat: 50, lon: 20, size: 0.5 },
  { lat: 12, lon: 20, size: 0.38 },
  { lat: 36, lon: 95, size: 0.54 },
  { lat: -25, lon: 135, size: 0.32 },
  { lat: 72, lon: -40, size: 0.24 },
];

function GlobeScene({ data }: { data: WorldMapData }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef(data);

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.25, 5.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.position = "relative";
    renderer.domElement.style.zIndex = "1";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.x = -0.18;
    scene.add(root);

    const globeGeometry = new THREE.SphereGeometry(2, 96, 96);
    const globeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1267d6,
      emissive: 0x082f49,
      emissiveIntensity: 0.38,
      roughness: 0.68,
      metalness: 0.04,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    root.add(globe);

    const atmosphereGeometry = new THREE.SphereGeometry(2.08, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.14, side: THREE.BackSide });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    root.add(atmosphere);

    const wireGeometry = new THREE.SphereGeometry(2.018, 36, 24);
    const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xbbf7d0, wireframe: true, transparent: true, opacity: 0.2 });
    const wire = new THREE.Mesh(wireGeometry, wireMaterial);
    root.add(wire);

    const landGroup = new THREE.Group();
    const landMaterial = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.82 });
    for (const patch of visibleLandPatches) {
      const land = new THREE.Mesh(new THREE.CircleGeometry(patch.size, 18), landMaterial);
      land.position.copy(latLonToSphere(patch.lat, patch.lon));
      land.lookAt(new THREE.Vector3(0, 0, 0));
      land.rotateY(Math.PI);
      landGroup.add(land);
    }
    root.add(landGroup);

    const regionGroup = new THREE.Group();
    root.add(regionGroup);

    const spawnGeometry = new THREE.SphereGeometry(0.075, 16, 16);
    const spawnMaterial = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const spawnMarker = new THREE.Mesh(spawnGeometry, spawnMaterial);
    spawnMarker.position.copy(latLonToSphere(0, 0, 2.15));
    root.add(spawnMarker);

    const ambient = new THREE.AmbientLight(0xe0fff7, 1.45);
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(3, 4, 6);
    const rim = new THREE.DirectionalLight(0x22d3ee, 1.8);
    rim.position.set(-4, -1, -3);
    scene.add(ambient, key, rim);

    const pointer = { down: false, x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => { pointer.down = true; pointer.x = event.clientX; pointer.y = event.clientY; renderer.domElement.setPointerCapture(event.pointerId); };
    const onPointerUp = (event: PointerEvent) => { pointer.down = false; renderer.domElement.releasePointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer.down) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      root.rotation.y += dx * 0.006;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.004, -0.9, 0.9);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    let lastRegionSignature = "";
    function rebuildRegions() {
      const current = dataRef.current;
      const bounds = current.world.loadedBlockBounds;
      const signature = `${current.regions.map((r) => r.id).join("|")}:${bounds?.minX}:${bounds?.minZ}:${bounds?.maxX}:${bounds?.maxZ}:${current.world.spawn.x}:${current.world.spawn.z}`;
      if (signature === lastRegionSignature) return;
      lastRegionSignature = signature;
      regionGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      regionGroup.clear();
      if (!bounds) return;
      for (const region of current.regions) {
        const center = regionCenter(region);
        const position = blockToSphere(center.x, center.z, bounds, 2.035);
        const tile = new THREE.Mesh(new THREE.CircleGeometry(0.045, 6), new THREE.MeshBasicMaterial({ color: region.regionX === 0 && region.regionZ === 0 ? 0xfacc15 : 0x34d399, transparent: true, opacity: 0.9 }));
        tile.position.copy(position);
        tile.lookAt(new THREE.Vector3(0, 0, 0));
        tile.rotateY(Math.PI);
        regionGroup.add(tile);
      }
      const spawn = blockToSphere(current.world.spawn.x, current.world.spawn.z, bounds, 2.13);
      spawnMarker.visible = true;
      spawnMarker.position.copy(spawn);
    }

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      rebuildRegions();
      if (!pointer.down) root.rotation.y += 0.0018;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      globeGeometry.dispose();
      globeMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      landGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      landMaterial.dispose();
      spawnGeometry.dispose();
      spawnMaterial.dispose();
      regionGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative min-h-[520px] w-full cursor-grab overflow-hidden rounded-[2rem] border border-cyan-200/30 bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.22),rgba(15,23,42,0.7)_42%,rgba(2,6,23,0.95)_72%)] shadow-2xl shadow-cyan-950/40 active:cursor-grabbing"
      aria-label="Interactive 3D discovered world globe"
    >
      <div className="pointer-events-none absolute inset-8 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-5 left-6 z-10 rounded-full border border-cyan-200/25 bg-slate-950/55 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-100">
        Drag to rotate Earth
      </div>
    </div>
  );
}

export function WorldMapDashboard() {
  const [data, setData] = useState<WorldMapData>(emptyMap);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function refresh(showBusy = false) {
    if (showBusy) setRefreshing(true);
    try {
      const res = await fetch("/api/world-map", { cache: "no-store" });
      if (!res.ok) throw new Error(`World map failed: ${res.status}`);
      const next = await res.json();
      setData(next);
      writeClientCache(CACHE_KEY, next);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cached = readClientCache<WorldMapData>(CACHE_KEY);
    if (cached) setData(cached);
    void refresh(false);
    const timer = window.setInterval(() => void refresh(false), POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const boundsLabel = useMemo(() => {
    const bounds = data.world.loadedBlockBounds;
    if (!bounds) return "No discovered region files loaded yet";
    return `X ${format(bounds.minX)} → ${format(bounds.maxX)} · Z ${format(bounds.minZ)} → ${format(bounds.maxZ)}`;
  }, [data.world.loadedBlockBounds]);

  const trackingArtifacts = data.tracking?.artifacts ?? [];
  const artifactBase = data.tracking?.publicBaseUrl ?? "";
  const artifactUrl = (path: string) => path.startsWith("http") || path.startsWith("/") ? path : `${artifactBase}/${path}`;

  return (
    <div className="space-y-6">
      <header className="grid gap-5 rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Public world map</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">3D Earth Ball</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-300">A live globe of the GizmoCraft world. It starts from spawn and paints the region files we have discovered/loaded so far; new explored regions appear automatically as the bridge sees more world files.</p>
        </div>
        <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-5 text-sm">
          <p className="font-black text-lime-100">{refreshing ? "Refreshing scan…" : data.live ? "Live bridge scan · 15s refresh" : failed ? "Showing last loaded map" : "Last loaded map"}</p>
          <p className="mt-2 text-slate-300">Last scan: {data.world.lastScan}</p>
          <button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="mt-4 rounded-full bg-lime-300 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-wait disabled:opacity-70">{refreshing ? "Refreshing…" : "Refresh now"}</button>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <GlobeScene data={data} />
        <aside className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Stat label="Discovered regions" value={format(data.world.regionCount)} />
            <Stat label="Approx. loaded chunks" value={format(data.world.discoveredChunks)} />
            <Stat label="Spawn origin" value={`X ${format(data.world.spawn.x)} · Z ${format(data.world.spawn.z)}`} />
            <Stat label="Loaded block bounds" value={boundsLabel} />
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="text-xl font-black">Data visibility plan</h2>
            <Visibility label="Available to everyone" items={data.visibility.public} tone="emerald" />
            <Visibility label="Signed-in overlays later" items={data.visibility.signedIn} tone="sky" />
            <Visibility label="Restricted/private later" items={data.visibility.restricted} tone="rose" />
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/8 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200/80">Minecraft tracking backend</p>
            <h2 className="mt-1 text-2xl font-black">Live-survey map layer</h2>
            <p className="mt-1 text-sm text-slate-300">
              {data.tracking?.available
                ? `Generated ${data.tracking.generatedAt ?? "recently"} via ${data.tracking.method ?? "world/player survey"}.`
                : data.tracking?.note ?? "Waiting for the mapper bot/survey collector to publish map artifacts."}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${data.tracking?.available ? "bg-emerald-300 text-slate-950" : "bg-amber-300 text-slate-950"}`}>
            {data.tracking?.available ? "tracking artifacts online" : data.tracking?.status ?? "not generated"}
          </span>
        </div>
        {data.tracking?.players?.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {data.tracking.players.map((player) => (
              <div key={player.name} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
                <p className="font-black text-white">{player.name}</p>
                <p className="text-slate-300">X {format(player.x)} · Y {format(player.y)} · Z {format(player.z)}</p>
              </div>
            ))}
          </div>
        ) : null}
        {trackingArtifacts.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {trackingArtifacts.filter((artifact) => artifact.kind === "image").map((artifact) => (
              <a key={artifact.id} href={artifactUrl(artifact.path)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                <img src={artifactUrl(artifact.path)} alt={artifact.label} className="h-48 w-full object-cover opacity-90 transition group-hover:scale-[1.02] group-hover:opacity-100" />
                <p className="px-4 py-3 text-sm font-black text-white">{artifact.label}</p>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Loaded from spawn outward</h2>
            <p className="mt-1 text-sm text-slate-400">Each tile is a Minecraft region file (`512 × 512` blocks). Empty areas are not loaded yet, not deleted.</p>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">{data.regions.length} live tiles</span>
        </div>
        <div className="mt-4 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {data.regions.length ? data.regions.map((region) => (
            <div key={region.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
              <p className="font-black text-white">Region {region.regionX}, {region.regionZ}</p>
              <p className="text-slate-400">X {format(region.minBlockX)} → {format(region.maxBlockX)} · Z {format(region.minBlockZ)} → {format(region.maxBlockZ)}</p>
            </div>
          )) : <p className="text-sm text-slate-300">No live region list available yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/8 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>;
}

function Visibility({ label, items, tone }: { label: string; items: string[]; tone: "emerald" | "sky" | "rose" }) {
  const classes = tone === "emerald" ? "text-emerald-100 bg-emerald-300/10" : tone === "sky" ? "text-sky-100 bg-sky-300/10" : "text-rose-100 bg-rose-300/10";
  return (
    <div className="mt-4">
      <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes}`}>{label}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-300">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
