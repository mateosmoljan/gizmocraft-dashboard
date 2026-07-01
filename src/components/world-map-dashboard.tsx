"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { emptyWorldMapData, GIZMOCRAFT_WORLD_SYNC_MODPACK, WORLD_MAP_CLIENT_CACHE_KEY, WORLD_MAP_REFRESH_SECONDS } from "@/lib/world-map";
import type { WorldMapData, WorldMapRegion } from "@/lib/world-map";

const POLL_MS = WORLD_MAP_REFRESH_SECONDS * 1_000;

const emptyMap: WorldMapData = emptyWorldMapData();

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
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
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
    const visitedGroup = new THREE.Group();
    root.add(visitedGroup);
    const playerGroup = new THREE.Group();
    root.add(playerGroup);

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
      const visitedSignature = current.tracking?.visitedChunks?.map((chunk) => chunk.id).join("|") ?? "";
      const playerSignature = current.tracking?.livePlayers?.map((player) => `${player.name}:${player.chunkX}:${player.chunkZ}:${player.lastSeenAt}`).join("|") ?? "";
      const signature = `${current.regions.map((r) => r.id).join("|")}:${visitedSignature}:${playerSignature}:${bounds?.minX}:${bounds?.minZ}:${bounds?.maxX}:${bounds?.maxZ}:${current.world.spawn.x}:${current.world.spawn.z}`;
      if (signature === lastRegionSignature) return;
      lastRegionSignature = signature;
      [regionGroup, visitedGroup, playerGroup].forEach((group) => group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      }));
      regionGroup.clear();
      visitedGroup.clear();
      playerGroup.clear();
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
      for (const chunk of current.tracking?.visitedChunks?.slice(0, 900) ?? []) {
        const position = blockToSphere(chunk.chunkX * 16 + 8, chunk.chunkZ * 16 + 8, bounds, 2.105);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.92 }));
        dot.position.copy(position);
        dot.lookAt(new THREE.Vector3(0, 0, 0));
        dot.rotateY(Math.PI);
        visitedGroup.add(dot);
      }
      for (const player of current.tracking?.livePlayers ?? []) {
        const position = blockToSphere(player.x, player.z, bounds, 2.22);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
        marker.position.copy(position);
        playerGroup.add(marker);
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
      [visitedGroup, playerGroup].forEach((group) => group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      }));
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

export function WorldMapDashboard({ initialData = emptyMap }: { initialData?: WorldMapData }) {
  const [data, setData] = useState<WorldMapData | null>(initialData.live ? initialData : null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function refresh(showBusy = false) {
    if (showBusy) setRefreshing(true);
    try {
      const res = await fetch(`/api/world-map?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`World map failed: ${res.status}`);
      const next = await res.json();
      setData(next);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (initialData.live) setData(initialData);

    async function refreshVisibleMap() {
      if (document.visibilityState !== "visible") return;
      await refresh(false);
    }

    void refreshVisibleMap();
    const timer = window.setInterval(() => void refreshVisibleMap(), POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshVisibleMap();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialData]);

  const loading = data === null;
  const displayData = data ?? emptyMap;

  const boundsLabel = useMemo(() => {
    const bounds = displayData.world.loadedBlockBounds;
    if (!bounds) return "No discovered region files loaded yet";
    return `X ${format(bounds.minX)} → ${format(bounds.maxX)} · Z ${format(bounds.minZ)} → ${format(bounds.maxZ)}`;
  }, [displayData.world.loadedBlockBounds]);

  const livePlayers = displayData.tracking?.livePlayers ?? [];
  const visitedChunks = displayData.tracking?.visitedChunks ?? [];

  return (
    <div className="space-y-6">
      <header className="grid gap-5 rounded-3xl border border-emerald-300/20 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Public world map</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">3D Earth Ball</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-300">A live globe of the GizmoCraft world. Green tiles are server region files, orange sparks are client-visited chunks, and pink beacons are live players from the new Fabric heartbeat.</p>
        </div>
        <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-5 text-sm">
          <p className="font-black text-lime-100">{loading ? failed ? "Waiting for database" : "Fetching map database" : displayData.live ? "Live bridge + client heartbeat · auto-refreshing" : "Map database pending"}</p>
          {loading ? <MapSkeleton className="mt-2 h-5 w-40" /> : <p className="mt-2 text-slate-300">Last scan: {displayData.world.lastScan}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={GIZMOCRAFT_WORLD_SYNC_MODPACK.href} download={GIZMOCRAFT_WORLD_SYNC_MODPACK.fileName} className="rounded-full border border-white/20 bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-100">
              {GIZMOCRAFT_WORLD_SYNC_MODPACK.label}
            </a>
          </div>
          <p className="mt-3 text-xs text-lime-100/80">{GIZMOCRAFT_WORLD_SYNC_MODPACK.status}</p>
        </div>
      </header>

      <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 shadow-xl shadow-cyan-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-100/80">Client modpack</p>
            <h2 className="mt-1 text-2xl font-black text-white">Live tracking companion mod</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{GIZMOCRAFT_WORLD_SYNC_MODPACK.summary} The dashboard turns those heartbeats into pink live-player beacons and orange visited-chunk memory.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <details className="group relative">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-full border border-cyan-100/40 bg-slate-950/45 px-5 py-3 text-sm font-black text-cyan-50 transition hover:bg-slate-900">
                How to install
              </summary>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-sm text-slate-200 shadow-2xl shadow-black/40 lg:absolute lg:right-0 lg:z-20 lg:w-[28rem]">
                <p className="font-black text-white">Simple install directions</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Download and unzip the pack.</li>
                  <li>Open Minecraft folder: Windows <code className="rounded bg-black/35 px-1">%APPDATA%\.minecraft</code>.</li>
                  <li>Copy <code className="rounded bg-black/35 px-1">mods/{GIZMOCRAFT_WORLD_SYNC_MODPACK.jarName}</code> from the zip.</li>
                  <li>Put that <code className="rounded bg-black/35 px-1">.jar</code> in <code className="rounded bg-black/35 px-1">.minecraft/mods</code>.</li>
                  <li>Launch Fabric with Iris/Sodium. The mod creates <code className="rounded bg-black/35 px-1">shaderpacks</code> and auto-downloads verified Bliss Shaders if missing.</li>
                  <li>Select Bliss in Minecraft: Options → Video Settings → Shader Packs.</li>
                  <li>Do not put <code className="rounded bg-black/35 px-1">manifest.json</code> or <code className="rounded bg-black/35 px-1">README.md</code> in mods.</li>
                </ol>
              </div>
            </details>
            <a href={GIZMOCRAFT_WORLD_SYNC_MODPACK.href} download={GIZMOCRAFT_WORLD_SYNC_MODPACK.fileName} className="inline-flex items-center justify-center rounded-full bg-cyan-200 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-white">
              {GIZMOCRAFT_WORLD_SYNC_MODPACK.label}
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-cyan-100/75">Version {GIZMOCRAFT_WORLD_SYNC_MODPACK.version} · {GIZMOCRAFT_WORLD_SYNC_MODPACK.status}</p>
      </section>

      {failed && loading ? <MapRetryPanel refreshing={refreshing} onRetry={() => void refresh(true)} /> : null}

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <GlobeScene data={displayData} />
        <aside className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Stat label="Discovered regions" value={format(displayData.world.regionCount)} loading={loading} />
            <Stat label="Approx. loaded chunks" value={format(displayData.world.discoveredChunks)} loading={loading} />
            <Stat label="Live tracked players" value={format(livePlayers.length)} loading={loading} />
            <Stat label="Client visited chunks" value={format(visitedChunks.length)} loading={loading} />
            <Stat label="Spawn origin" value={`X ${format(displayData.world.spawn.x)} · Z ${format(displayData.world.spawn.z)}`} loading={loading} />
            <Stat label="Loaded block bounds" value={boundsLabel} loading={loading} />
          </div>
          <div className="rounded-3xl border border-pink-300/20 bg-pink-300/10 p-5">
            <h2 className="text-xl font-black text-white">Live player beacons</h2>
            <p className="mt-1 text-sm text-pink-100/80">{loading ? "Waiting for map database." : displayData.tracking?.liveTelemetryAt ? `Last heartbeat ${displayData.tracking.liveTelemetryAt}` : "Waiting for a client heartbeat from the v0.2.0 mod."}</p>
            <div className="mt-4 space-y-2">
              {livePlayers.length ? livePlayers.map((player) => (
                <div key={player.name} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
                  <p className="font-black text-white">{player.name}</p>
                  <p className="text-slate-300">X {format(Math.round(player.x))} · Y {format(Math.round(player.y))} · Z {format(Math.round(player.z))}</p>
                  <p className="text-xs text-pink-100/70">Chunk {player.chunkX}, {player.chunkZ}</p>
                </div>
              )) : <p className="text-sm text-slate-300">No live client has checked in yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="text-xl font-black">Data visibility plan</h2>
            <Visibility label="Available to everyone" items={displayData.visibility.public} tone="emerald" />
            <Visibility label="Signed-in overlays later" items={displayData.visibility.signedIn} tone="sky" />
            <Visibility label="Restricted/private later" items={displayData.visibility.restricted} tone="rose" />
          </div>
        </aside>
      </section>

    </div>
  );
}

function MapSkeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-cyan-200/15 ${className}`} aria-label="Loading data" />;
}

function MapRetryPanel({ refreshing, onRetry }: { refreshing: boolean; onRetry: () => void }) {
  return (
    <section className="mx-auto flex min-h-56 max-w-xl flex-col items-center justify-center rounded-3xl border border-amber-300/25 bg-amber-300/8 p-8 text-center">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-100/80">Database timeout</p>
      <h2 className="mt-2 text-2xl font-black text-white">Map data did not load</h2>
      <p className="mt-2 text-sm text-slate-300">Automatic retry is still running. You can also refresh this data now.</p>
      <button type="button" onClick={onRetry} disabled={refreshing} className="mt-5 rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70">
        {refreshing ? "Retrying…" : "Refresh data"}
      </button>
    </section>
  );
}

function Stat({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return <div className="rounded-3xl border border-white/10 bg-white/8 p-5"><p className="text-sm text-slate-400">{label}</p>{loading ? <MapSkeleton className="mt-2 h-7 w-28" /> : <p className="mt-2 text-2xl font-black text-white">{value}</p>}</div>;
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
