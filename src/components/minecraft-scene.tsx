"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function MinecraftScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 2.6, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "h-full w-full";
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const emerald = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.58, metalness: 0.08 });
    const lime = new THREE.MeshStandardMaterial({ color: 0xb7f56a, roughness: 0.7, metalness: 0.02 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x273449, roughness: 0.82, metalness: 0.02 });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x6b442d, roughness: 0.85, metalness: 0.0 });
    const cubeGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72);

    for (let x = -3; x <= 3; x += 1) {
      for (let z = -2; z <= 2; z += 1) {
        const mat = (x + z) % 3 === 0 ? emerald : (x + z) % 2 === 0 ? stone : dirt;
        const cube = new THREE.Mesh(cubeGeo, mat);
        cube.position.set(x * 0.78, Math.sin((x * 19 + z * 7) * 0.4) * 0.16, z * 0.78);
        cube.rotation.y = 0.78;
        cube.rotation.x = 0.16;
        group.add(cube);
      }
    }

    const pickaxe = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.16), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.62 }));
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.34, metalness: 0.45 }));
    head.position.y = 1.18;
    pickaxe.add(handle, head);
    pickaxe.position.set(2.35, 1.25, -0.8);
    pickaxe.rotation.z = -0.68;
    pickaxe.rotation.y = -0.35;
    group.add(pickaxe);

    scene.add(new THREE.AmbientLight(0xa7f3d0, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.65);
    key.position.set(3, 5, 4);
    scene.add(key);
    const glow = new THREE.PointLight(0x34d399, 2.4, 8);
    glow.position.set(-2.2, 1.6, 2.8);
    scene.add(glow);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = Math.max(clientWidth, 1) / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      group.rotation.y = Math.sin(t * 0.16) * 0.16 - 0.32;
      group.rotation.x = Math.sin(t * 0.12) * 0.04;
      pickaxe.rotation.z = -0.68 + Math.sin(t * 0.9) * 0.05;
      glow.intensity = 2 + Math.sin(t * 1.4) * 0.5;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.dispose();
      cubeGeo.dispose();
      emerald.dispose();
      lime.dispose();
      stone.dispose();
      dirt.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none fixed inset-0 z-0 opacity-45 blur-[0.2px]" aria-hidden="true" />;
}
