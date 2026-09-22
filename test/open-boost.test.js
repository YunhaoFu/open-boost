import { test, describe, it } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

import { stripJsonComments, patchOpenCodeConfig } from "../packages/adapters/opencode/index.js";
import { patchOmpConfig } from "../packages/adapters/omp/index.js";
import { buildAll } from "../packages/compiler/src/index.js";
import { getHarnessPaths, checkStatus } from "../packages/cli/src/installer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

describe("open-boost test suite", () => {
  it("stripJsonComments preserves URLs while stripping comments", () => {
    const jsonc = `{
      // Top-level comment
      "$schema": "https://opencode.ai/config.json", // url should remain intact
      "subagent_depth": 3, /* inline block comment */
      "testUrl": "http://example.com/a//b/c"
    }`;

    const stripped = stripJsonComments(jsonc);
    const parsed = JSON.parse(stripped);

    assert.strictEqual(parsed.$schema, "https://opencode.ai/config.json");
    assert.strictEqual(parsed.subagent_depth, 3);
    assert.strictEqual(parsed.testUrl, "http://example.com/a//b/c");
  });

  it("compiler builds all distributions with correct schemas", () => {
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), "open-boost-test-dist-"));
    try {
      const result = buildAll(rootDir, tmpDist);
      assert.strictEqual(result.success, true);

      // Verify OMP files
      assert.ok(fs.existsSync(path.join(tmpDist, "omp", "skills", "boost", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpDist, "omp", "agents", "boost-coder-coordinator.md")));
      const ompSkill = fs.readFileSync(path.join(tmpDist, "omp", "skills", "boost", "SKILL.md"), "utf8");
      assert.match(ompSkill, /tasks: \[\{ agent: "boost-coder-coordinator", task: "\.\.\." \}\]/);
      assert.match(ompSkill, /Plan & Review/);
      const ompCoord = fs.readFileSync(path.join(tmpDist, "omp", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(ompCoord, /tools: \[\]/);
      assert.match(ompCoord, /tasks: \[\{ agent: "boost-coder-l0", task: "\.\.\." \}\]/);
      assert.match(ompCoord, /Budget & Pacing Awareness/);
      const ompInvestL0 = fs.readFileSync(path.join(tmpDist, "omp", "agents", "boost-investigator-l0.md"), "utf8");
      assert.match(ompInvestL0, /tools: \[read, grep, glob, bash\]/);
      assert.doesNotMatch(ompInvestL0, /lsp/);
      assert.doesNotMatch(ompInvestL0, /ast_grep/);
      // Verify Pi files
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "skills", "boost", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "extensions", "open-boost.js")));
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "extensions", "open-boost.ts")));
      const piSkill = fs.readFileSync(path.join(tmpDist, "pi", "skills", "boost", "SKILL.md"), "utf8");
      assert.match(piSkill, /`subagent` tool, agent `boost-coder-coordinator`/);
      const piCoord = fs.readFileSync(path.join(tmpDist, "pi", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(piCoord, /allowNestedSubagents: true/);
      assert.match(piCoord, /allowedAgents:/);
      assert.match(piCoord, /Spawn it with the `subagent` tool/);

      // Verify OpenCode files
      assert.ok(fs.existsSync(path.join(tmpDist, "opencode", "skills", "boost", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpDist, "opencode", "commands", "boost.json")));
      const ocSkill = fs.readFileSync(path.join(tmpDist, "opencode", "skills", "boost", "SKILL.md"), "utf8");
      assert.match(ocSkill, /`task` tool \(`subagent_type: "boost-coder-coordinator"`\)/);
      const ocCoord = fs.readFileSync(path.join(tmpDist, "opencode", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(ocCoord, /mode: subagent/);
      assert.match(ocCoord, /tools: \{\}/);
      assert.match(ocCoord, /subagent_type: "boost-coder-l0"/);
      assert.match(ocCoord, /subagent_type: "boost-coder-improvement"/);

      const ocInvestL0 = fs.readFileSync(path.join(tmpDist, "opencode", "agents", "boost-investigator-l0.md"), "utf8");
      assert.match(ocInvestL0, /read: true/);
      assert.match(ocInvestL0, /bash: true/);
    } finally {
      fs.rmSync(tmpDist, { recursive: true, force: true });
    }
  });

  it("patchOmpConfig ensures task limits (depth >= 3, concurrency >= 4, budget >= 120, runtime >= 1200000)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-cfg-test-"));
    const cfgPath = path.join(tmpDir, "config.yml");
    try {
      // Case 1: task section with lower values and missing keys
      fs.writeFileSync(cfgPath, "task:\n  maxRecursionDepth: 1\n  softRequestBudget: 100\n  maxRuntimeMs: 900000\n");
      const { changed } = patchOmpConfig(cfgPath);
      assert.strictEqual(changed, true);

      let updated = fs.readFileSync(cfgPath, "utf8");
      assert.match(updated, /maxRecursionDepth: 3/);
      assert.match(updated, /maxConcurrency: 4/);
      assert.match(updated, /softRequestBudget: 120/);
      assert.match(updated, /maxRuntimeMs: 1200000/);

      // Idempotency: second run should not change anything
      const secondRun = patchOmpConfig(cfgPath);
      assert.strictEqual(secondRun.changed, false);

      // Case 2: empty/no task section
      const noTaskCfg = path.join(tmpDir, "config-empty.yml");
      fs.writeFileSync(noTaskCfg, "setupVersion: 2\n");
      const res2 = patchOmpConfig(noTaskCfg);
      assert.strictEqual(res2.changed, true);
      const updated2 = fs.readFileSync(noTaskCfg, "utf8");
      assert.match(updated2, /task:\n  maxRecursionDepth: 3\n  maxConcurrency: 4\n  softRequestBudget: 120\n  maxRuntimeMs: 1200000/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("patchOpenCodeConfig preserves existing keys and injects subagent_depth & boost command", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-cfg-test-"));
    const cfgPath = path.join(tmpDir, "opencode.jsonc");
    try {
      fs.writeFileSync(
        cfgPath,
        `{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": { "dummy": true }\n}`
      );
      const { changed, config } = patchOpenCodeConfig(cfgPath);
      assert.strictEqual(changed, true);
      assert.strictEqual(config.subagent_depth, 3);
      assert.ok(config.command?.boost);

      const reloaded = JSON.parse(stripJsonComments(fs.readFileSync(cfgPath, "utf8")));
      assert.strictEqual(reloaded.$schema, "https://opencode.ai/config.json");
      assert.strictEqual(reloaded.mcp?.dummy, true);
      assert.strictEqual(reloaded.subagent_depth, 3);
      assert.strictEqual(reloaded.command?.boost?.subtask, false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SSOT Prompts satisfy the 7 Boost Invariants", () => {
    const promptsDir = path.join(rootDir, "packages", "core", "prompts");
    const requiredPrompts = [
      "orchestrator.md",
      "boost-coder-coordinator.md",
      "boost-coder-l0.md",
      "boost-coder-improvement.md",
      "boost-investigator-coordinator.md",
      "boost-investigator-l0.md",
      "boost-investigator-improvement.md",
    ];

    for (const name of requiredPrompts) {
      assert.ok(fs.existsSync(path.join(promptsDir, name)), `Missing prompt: ${name}`);
    }

    const orchestrator = fs.readFileSync(path.join(promptsDir, "orchestrator.md"), "utf8");
    assert.match(orchestrator, /Solo Routine/);
    assert.match(orchestrator, /Delegation Routine/);
    assert.match(orchestrator, /No Pre-work/);
    assert.match(orchestrator, /\*\*Task\*\*/);
    assert.match(orchestrator, /Plan & Review/);

    const coderL0 = fs.readFileSync(path.join(promptsDir, "boost-coder-l0.md"), "utf8");
    assert.match(coderL0, /Skepticism Disclaimer/);
    assert.match(coderL0, /Verification Record/);
    assert.match(coderL0, /Deep Verification/);
    assert.match(coderL0, /Budget Pacing/);

    const coderImp = fs.readFileSync(path.join(promptsDir, "boost-coder-improvement.md"), "utf8");
    assert.match(coderImp, /Step 1.*Understand the task independently/);
    assert.match(coderImp, /Step 2.*Break it/);
    assert.match(coderImp, /Step 3.*Fix/);

    const investL0 = fs.readFileSync(path.join(promptsDir, "boost-investigator-l0.md"), "utf8");
    assert.match(investL0, /Remaining Questions & Gaps/);
  });

  it("checkStatus correctly identifies installed harnesses", () => {
    const status = checkStatus();
    assert.ok(status.omp.detected);
    assert.ok(status.pi.detected);
    assert.ok(status.opencode.detected);

    assert.strictEqual(status.omp.agentsInstalled, 6);
    assert.strictEqual(status.pi.agentsInstalled, 6);
    assert.strictEqual(status.opencode.agentsInstalled, 6);

    assert.strictEqual(status.omp.skillInstalled, true);
    assert.strictEqual(status.pi.skillInstalled, true);
    assert.strictEqual(status.opencode.skillInstalled, true);

    assert.strictEqual(status.omp.configReady, true);
    assert.strictEqual(status.pi.configReady, true);
    assert.strictEqual(status.opencode.configReady, true);
  });
});
