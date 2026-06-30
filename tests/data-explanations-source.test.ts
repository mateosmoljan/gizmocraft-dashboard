import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("dashboard pages do not show distracting explanation buttons", () => {
  assert.equal(existsSync("src/components/data-explain-button.tsx"), false);

  const dashboardSource = readFileSync("src/components/dashboard.tsx", "utf8");
  assert.doesNotMatch(dashboardSource, /DataExplainButton/);
  assert.doesNotMatch(dashboardSource, /data-explain-button/);
  assert.doesNotMatch(dashboardSource, /boardExplanation|explainStat/);

  const usageSource = readFileSync("src/components/usage-dashboard.tsx", "utf8");
  assert.doesNotMatch(usageSource, /DataExplainButton/);
  assert.doesNotMatch(usageSource, /data-explain-button/);
  assert.doesNotMatch(usageSource, /explainUsageMetric/);
});
