import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("GizmoCraft exposes installable PWA metadata", () => {
  const manifest = readFileSync("src/app/manifest.ts", "utf8");
  assert.match(manifest, /name: "GizmoCraft Dashboard"/);
  assert.match(manifest, /id: "\/gizmocraft-dashboard"/);
  assert.match(manifest, /short_name: "GizmoCraft"/);
  assert.match(manifest, /start_url: "\/dashboard\?source=pwa"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /\/icons\/gizmocraft-logo-192\.png/);
  assert.match(manifest, /\/icons\/gizmocraft-logo-512\.png/);
  assert.match(manifest, /purpose: "maskable"/);

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /ServiceWorkerRegistration/);

  const shell = readFileSync("src/components/gizmo-shell.tsx", "utf8");
  assert.match(shell, /InstallAppButton/);

  const installButton = readFileSync("src/components/install-app-button.tsx", "utf8");
  assert.match(installButton, /beforeinstallprompt/);
  assert.match(installButton, /appinstalled/);
  assert.match(installButton, /display-mode: standalone/);
  assert.match(installButton, /iphone\|ipad\|ipod/);
  assert.match(installButton, /if \(installed \|\| \(!installPrompt && !showIosInstallHelp\)\) return null/);

  const sw = readFileSync("public/sw.js", "utf8");
  assert.match(sw, /self\.addEventListener\("install"/);
  assert.match(sw, /self\.addEventListener\("fetch"/);

  for (const icon of [
    "public/gizmocraft-logo-icon.png",
    "public/icons/gizmocraft-logo-192.png",
    "public/icons/gizmocraft-logo-512.png",
    "public/icons/gizmocraft-logo-maskable-512.png",
    "public/icons/gizmocraft-logo-apple-touch.png",
  ]) {
    assert.equal(existsSync(icon), true, `${icon} should exist`);
  }
});
