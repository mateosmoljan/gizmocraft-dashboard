import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const retryCopy = /Database timeout[\s\S]*Refresh data/;

test("dashboard shows a centered retry button only after initial data fetch fails", () => {
  const source = readFileSync("src/components/dashboard.tsx", "utf8");

  assert.match(source, /const \[failed, setFailed\] = useState\(false\)/);
  assert.match(source, /setFailed\(true\)/);
  assert.match(source, /const showRetry = failed && data === null/);
  assert.match(source, /<DataLoadRetry retrying=\{retrying\} onRetry=\{\(\) => void refresh\(true, true\)\}/);
  assert.match(source, retryCopy);
  assert.match(source, /window\.setInterval\(\(\) => void refreshVisibleDashboard\(true\), LIVE_REFRESH_MS\)/);
});

test("secondary live data pages keep auto-refresh and expose retry only for empty failed states", () => {
  const usage = readFileSync("src/components/usage-dashboard.tsx", "utf8");
  assert.match(usage, /usageLoading && \(usage\.note \|\| error\)/);
  assert.match(usage, /<UsageRetryPanel refreshing=\{refreshing\} onRetry=\{\(\) => void refreshUsage\(true\)\}/);
  assert.match(usage, /window\.setInterval\(\(\) => void refreshLiveUsage\(false\), LIVE_REFRESH_MS\)/);

  const world = readFileSync("src/components/world-map-dashboard.tsx", "utf8");
  assert.match(world, /failed && loading \? <MapRetryPanel refreshing=\{refreshing\} onRetry=\{\(\) => void refresh\(true\)\}/);
  assert.match(world, /window\.setInterval\(\(\) => void refreshVisibleMap\(\), POLL_MS\)/);

  const profiles = readFileSync("src/components/public-profiles.tsx", "utf8");
  assert.match(profiles, /failed && !profiles\.length && !loading/);
  assert.match(profiles, /<ProfilesRetryPanel onRetry=\{\(\) => void loadProfiles\(true\)\}/);
  assert.match(profiles, /window\.setInterval\(\(\) => \{/);

  const screenshots = readFileSync("src/components/screenshots-dashboard.tsx", "utf8");
  assert.match(screenshots, /\(error \|\| feed\.note\) && !feed\.screenshots\.length/);
  assert.match(screenshots, /<ScreenshotRetryPanel refreshing=\{refreshing\} onRetry=\{\(\) => void refreshFeedNow\(\)\}/);
  assert.match(screenshots, /window\.setInterval\(\(\) => void refreshFeed\(\), POLL_MS\)/);

  for (const source of [usage, world, profiles, screenshots]) {
    assert.match(source, retryCopy);
  }
});
