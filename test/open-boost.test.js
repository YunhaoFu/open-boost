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
      const ompCoord = fs.readFileSync(path.join(tmpDist, "omp", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(ompCoord, /tools: \[\]/);

      // Verify Pi files
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "skills", "boost", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "extensions", "open-boost.js")));
      assert.ok(fs.existsSync(path.join(tmpDist, "pi", "extensions", "open-boost.ts")));
      const piCoord = fs.readFileSync(path.join(tmpDist, "pi", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(piCoord, /allowNestedSubagents: true/);
      assert.match(piCoord, /allowedAgents:/);

      // Verify OpenCode files
      assert.ok(fs.existsSync(path.join(tmpDist, "opencode", "skills", "boost", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpDist, "opencode", "commands", "boost.json")));
      const ocCoord = fs.readFileSync(path.join(tmpDist, "opencode", "agents", "boost-coder-coordinator.md"), "utf8");
      assert.match(ocCoord, /mode: subagent/);
      assert.match(ocCoord, /tools: \{\}/);

      const ocInvestL0 = fs.readFileSync(path.join(tmpDist, "opencode", "agents", "boost-investigator-l0.md"), "utf8");
      assert.match(ocInvestL0, /read: true/);
      assert.match(ocInvestL0, /bash: true/);
    } finally {
      fs.rmSync(tmpDist, { recursive: true, force: true });
    }
  });

  it("patchOmpConfig ensures maxRecursionDepth >= 3", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-cfg-test-"));
    const cfgPath = path.join(tmpDir, "config.yml");
    try {
      fs.writeFileSync(cfgPath, "task:\n  maxRecursionDepth: 1\n");
      const { changed } = patchOmpConfig(cfgPath);
      assert.strictEqual(changed, true);

      const updated = fs.readFileSync(cfgPath, "utf8");
      assert.match(updated, /maxRecursionDepth: 3/);
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

    const coderL0 = fs.readFileSync(path.join(promptsDir, "boost-coder-l0.md"), "utf8");
    assert.match(coderL0, /Skepticism Disclaimer/);
    assert.match(coderL0, /Verification Record/);
    assert.match(coderL0, /Deep Verification/);

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
