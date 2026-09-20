#!/usr/bin/env node

/**
 * open-boost CLI
 *
 * Universal plugin & adapter management for open-boost:
 * - install: detects and installs open-boost into Pi, OpenCode, and OMP
 * - status: checks the readiness of open-boost across harnesses
 * - build: compiles distribution packages from core SSOT prompts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { getHarnessPaths, installHarness, checkStatus } from "../src/installer.js";
import { buildAll } from "../../compiler/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const distDir = path.join(repoRoot, "dist");

function printHelp() {
  console.log(`
⚡ open-boost: Universal Deep-Reasoning Multi-Agent Plugin for Coding Harnesses

Usage:
  open-boost install [--target <targets>]    Install open-boost to detected harnesses
  open-boost status                         Check open-boost installation status
  open-boost build                          Recompile dist/ from core SSOT prompts
  open-boost --help                         Show this help message

Options:
  --target, -t    Comma-separated list of harnesses: pi, opencode, omp (default: all detected)

Supported Harnesses:
  - Pi Coding Agent (pi)
  - OpenCode (opencode)
  - Oh My Pi (omp)
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  if (command === "build") {
    console.log("Compiling open-boost distribution packages...");
    buildAll(repoRoot, distDir);
    return;
  }

  if (command === "status") {
    console.log("⚡ Checking open-boost status across harnesses...\n");
    const status = checkStatus();
    for (const [key, s] of Object.entries(status)) {
      const name = key.toUpperCase();
      const detectedStr = s.detected ? `✓ Detected (${s.version || "found"})` : "✗ Not found";
      const agentsStr = `${s.agentsInstalled}/6 agents`;
      const skillStr = s.skillInstalled ? "✓ Skill ready" : "✗ Skill missing";
      const configStr = s.configReady ? "✓ Config/Nesting ready" : "✗ Config incomplete";
      console.log(`[${name}]:`);
      console.log(`  Harness: ${detectedStr}`);
      console.log(`  Agents:  ${agentsStr}`);
      console.log(`  Skill:   ${skillStr}`);
      console.log(`  Runtime: ${configStr}\n`);
    }
    return;
  }

  if (command === "install") {
    // Ensure dist exists before install
    if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, "omp"))) {
      console.log("Compiling open-boost distribution artifacts first...");
      buildAll(repoRoot, distDir);
    }

    let targets = [];
    const targetIdx = args.findIndex((a) => a === "--target" || a === "-t");
    if (targetIdx !== -1 && args[targetIdx + 1]) {
      targets = args[targetIdx + 1].split(",").map((t) => t.trim().toLowerCase());
    }

    const harnesses = getHarnessPaths();

    if (targets.length === 0) {
      // Auto-detect installed harnesses
      targets = Object.keys(harnesses).filter((h) => harnesses[h].detected);
      if (targets.length === 0) {
        console.log("No supported coding harnesses detected automatically.");
        console.log("You can specify explicit targets with --target omp,pi,opencode");
        return;
      }
    }

    console.log(`⚡ Installing open-boost to targets: ${targets.join(", ")}...\n`);

    for (const target of targets) {
      if (!harnesses[target]) {
        console.warn(`[Warning] Unknown target: ${target}`);
        continue;
      }
      const info = harnesses[target];
      const result = installHarness(target, distDir, info);
      if (result.success) {
        console.log(`✓ [${info.name}] Installation successful!`);
        for (const file of result.filesInstalled) {
          console.log(`    + ${file}`);
        }
      } else {
        console.error(`✗ [${info.name}] Installation failed: ${result.message}`);
      }
      console.log();
    }

    console.log("⚡ Installation finished! Run 'open-boost status' to verify.");
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("Error executing open-boost CLI:", err);
  process.exit(1);
});
