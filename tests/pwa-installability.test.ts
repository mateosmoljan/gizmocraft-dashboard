import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("GizmoCraft exposes installable PWA metadata", () => {
  const manifest = readFileSync("src/app/manifest.ts", "utf8");
  assert.match(manifest, /name: "GizmoCraft Dashboard"/);
  assert.match(manifest, /short_name: "GizmoCraft"/);
  assert.match(manifest, /start_url: "\/dashboard\?source=pwa"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /\/icons\/icon-192\.png/);
  assert.match(manifest, /\/icons\/icon-512\.png/);
  assert.match(manifest, /purpose: "maskable"/);

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /ServiceWorkerRegistration/);

  const sw = readFileSync("public/sw.js", "utf8");
  assert.match(sw, /self\.addEventListener\("install"/);
  assert.match(sw, /self\.addEventListener\("fetch"/);

  for (const icon of ["public/icons/icon-192.png", "public/icons/icon-512.png", "public/icons/maskable-512.png", "public/icons/apple-touch-icon.png"]) {
    assert.equal(existsSync(icon), true, `${icon} should exist`);
  }
});
