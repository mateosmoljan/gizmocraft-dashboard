import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("data grid elements expose exclamation explanation buttons", () => {
  const explainSource = readFileSync("src/components/data-explain-button.tsx", "utf8");
  assert.match(explainSource, /aria-label=\{`Explain \$\{label\}`\}/);
  assert.match(explainSource, />!/);
  assert.match(explainSource, /group-hover:opacity-100/);
  assert.match(explainSource, /group-focus-within:opacity-100/);

  const dashboardSource = readFileSync("src/components/dashboard.tsx", "utf8");
  assert.match(dashboardSource, /import \{ DataExplainButton \} from "@\/components\/data-explain-button"/);
  assert.match(dashboardSource, /<Stat label="Score"[\s\S]*explanation=/);
  assert.match(dashboardSource, /<DataExplainButton label=\{b\.title\} explanation=\{boardExplanation\(b\.title, b\.metric\)\}/);

  const usageSource = readFileSync("src/components/usage-dashboard.tsx", "utf8");
  assert.match(usageSource, /import \{ DataExplainButton \} from "@\/components\/data-explain-button"/);
  assert.match(usageSource, /<DataExplainButton label=\{metric\.label\} explanation=\{explainUsageMetric\(metric\)\}/);
});
