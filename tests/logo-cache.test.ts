import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const shellSource = readFileSync(new URL("../src/components/gizmo-shell.tsx", import.meta.url), "utf8");
const serviceWorkerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("GizmoCraft shell logo caching", () => {
  it("keeps a fixed-size brand logo in the shell chrome", () => {
    assert.match(shellSource, /src="\/brand\/gizmocraft-floating-world-logo\.png"/);
    assert.match(shellSource, /className="[^"]*size-14[^"]*shrink-0[^"]*"/);
  });

  it("keeps the desktop navigation fixed while page content scrolls", () => {
    assert.match(shellSource, /<aside className="[^"]*lg:fixed[^"]*lg:inset-y-0[^"]*lg:left-0[^"]*lg:h-screen[^"]*lg:overflow-y-auto[^"]*"/);
    assert.match(shellSource, /<main className="[^"]*lg:ml-72[^"]*"/);
    assert.doesNotMatch(shellSource, /lg:sticky/);
  });

  it("serves brand and icon image assets cache-first from the service worker", () => {
    assert.match(serviceWorkerSource, /gizmocraft-shell-v4/);
    assert.match(serviceWorkerSource, /"\/brand\/gizmocraft-floating-world-logo\.png"/);
    assert.match(serviceWorkerSource, /CACHE_FIRST_PATH_PREFIXES = \["\/brand\/", "\/icons\/"\]/);
    assert.match(serviceWorkerSource, /if \(shouldUseCacheFirst\(url\)\)/);
    assert.match(serviceWorkerSource, /if \(cached\) return cached/);
  });
});
