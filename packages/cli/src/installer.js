/**
 * Open-Boost Universal Cross-Platform Installer
 *
 * Supports Windows, Linux, and macOS.
 * Targets: OMP, Pi, OpenCode.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { patchOpenCodeConfig, stripJsonComments } from "../../adapters/opencode/index.js";
import { patchOmpConfig } from "../../adapters/omp/index.js";

/**
 * @typedef {"omp" | "pi" | "opencode"} HarnessType
 *
 * @typedef {Object} HarnessInfo
 * @property {HarnessType} type
 * @property {string} name
 * @property {boolean} detected
 * @property {string} [cliVersion]
 * @property {string} configDir
 * @property {string} agentsDir
 * @property {string} skillsDir
 * @property {string} [extensionsDir]
 */

/**
 * Detects installed harnesses and returns their standard paths across platforms.
 * @returns {Record<HarnessType, HarnessInfo>}
 */
export function getHarnessPaths() {
  const home = os.homedir();
  const isWindows = process.platform === "win32";

  // OMP paths
  const ompConfigDir = path.join(home, ".omp", "agent");
  const ompInfo = {
    type: "omp",
    name: "Oh My Pi (OMP)",
    detected: false,
    configDir: ompConfigDir,
    agentsDir: path.join(ompConfigDir, "agents"),
    skillsDir: path.join(ompConfigDir, "skills"),
  };

  // Pi paths
  const piConfigDir = path.join(home, ".pi", "agent");
  const piInfo = {
    type: "pi",
    name: "Pi Coding Agent",
    detected: false,
    configDir: piConfigDir,
    agentsDir: path.join(piConfigDir, "agents"),
    skillsDir: path.join(piConfigDir, "skills"),
    extensionsDir: path.join(piConfigDir, "extensions"),
  };

  // OpenCode paths
  let opencodeConfigDir = path.join(home, ".config", "opencode");
  if (isWindows && process.env.APPDATA && !fs.existsSync(opencodeConfigDir)) {
    opencodeConfigDir = path.join(process.env.APPDATA, "opencode");
  }
  const opencodeInfo = {
    type: "opencode",
    name: "OpenCode",
    detected: false,
    configDir: opencodeConfigDir,
    agentsDir: path.join(opencodeConfigDir, "agents"),
    skillsDir: path.join(opencodeConfigDir, "skills"),
  };

  // Detect CLI binaries
  try {
    const version = execSync("omp --version", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
    ompInfo.detected = true;
    ompInfo.cliVersion = version;
  } catch {
    if (fs.existsSync(ompConfigDir)) ompInfo.detected = true;
  }

  try {
    const version = execSync("pi --version", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
    piInfo.detected = true;
    piInfo.cliVersion = version;
  } catch {
    if (fs.existsSync(piConfigDir)) piInfo.detected = true;
  }

  try {
    const version = execSync("opencode --version", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" }).trim();
    opencodeInfo.detected = true;
    opencodeInfo.cliVersion = version;
  } catch {
    if (fs.existsSync(opencodeConfigDir)) opencodeInfo.detected = true;
  }

  return { omp: ompInfo, pi: piInfo, opencode: opencodeInfo };
}

/**
 * Copies a directory recursively.
 * @param {string} src
 * @param {string} dest
 */
export function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Installs open-boost distribution artifacts to the target harness.
 * @param {HarnessType} harness
 * @param {string} distDir
 * @param {HarnessInfo} paths
 * @returns {{ harness: HarnessType; success: boolean; message: string; filesInstalled: string[] }}
 */
export function installHarness(harness, distDir, paths) {
  const filesInstalled = [];
  try {
    const targetDist = path.join(distDir, harness);
    if (!fs.existsSync(targetDist)) {
      return {
        harness,
        success: false,
        message: `Compiled dist directory for ${harness} does not exist at ${targetDist}`,
        filesInstalled: [],
      };
    }

    if (harness === "omp") {
      // 1. Copy skills
      const skillSrc = path.join(targetDist, "skills", "boost");
      const skillDest = path.join(paths.skillsDir, "boost");
      copyDirRecursive(skillSrc, skillDest);
      filesInstalled.push(path.join(skillDest, "SKILL.md"));

      // 2. Copy agents
      const agentSrc = path.join(targetDist, "agents");
      copyDirRecursive(agentSrc, paths.agentsDir);
      for (const file of fs.readdirSync(agentSrc)) {
        filesInstalled.push(path.join(paths.agentsDir, file));
      }

      // 3. Patch config
      const configFile = path.join(paths.configDir, "config.yml");
      patchOmpConfig(configFile);
      filesInstalled.push(configFile + " (task limits verified: depth>=3, concurrency>=4, budget>=120, runtime>=1200000)");
    } else if (harness === "pi") {
      // 1. Copy extension
      if (paths.extensionsDir) {
        fs.mkdirSync(paths.extensionsDir, { recursive: true });
        const extSrcTs = path.join(targetDist, "extensions", "open-boost.ts");
        const extSrcJs = path.join(targetDist, "extensions", "open-boost.js");
        if (fs.existsSync(extSrcTs)) {
          const extDestTs = path.join(paths.extensionsDir, "open-boost.ts");
          fs.copyFileSync(extSrcTs, extDestTs);
          filesInstalled.push(extDestTs);
        }
        if (fs.existsSync(extSrcJs)) {
          const extDestJs = path.join(paths.extensionsDir, "open-boost.js");
          fs.copyFileSync(extSrcJs, extDestJs);
          filesInstalled.push(extDestJs);
        }
      }

      // 2. Copy agents
      const agentSrc = path.join(targetDist, "agents");
      copyDirRecursive(agentSrc, paths.agentsDir);
      for (const file of fs.readdirSync(agentSrc)) {
        filesInstalled.push(path.join(paths.agentsDir, file));
      }

      // 3. Copy skills
      const skillSrc = path.join(targetDist, "skills", "boost");
      const skillDest = path.join(paths.skillsDir, "boost");
      copyDirRecursive(skillSrc, skillDest);
      filesInstalled.push(path.join(skillDest, "SKILL.md"));

      // 4. Update ~/.pi/agent/settings.json to include skill if needed
      const settingsPath = path.join(paths.configDir, "settings.json");
      if (fs.existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          if (!settings.skills) settings.skills = [];
          const skillEntry = "+skills/boost/SKILL.md";
          if (!settings.skills.includes(skillEntry)) {
            settings.skills.push(skillEntry);
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
            filesInstalled.push(settingsPath + " (skill enabled)");
          }
        } catch {
          // ignore settings json error
        }
      }
    } else if (harness === "opencode") {
      // 1. Copy agents
      const agentSrc = path.join(targetDist, "agents");
      copyDirRecursive(agentSrc, paths.agentsDir);
      for (const file of fs.readdirSync(agentSrc)) {
        filesInstalled.push(path.join(paths.agentsDir, file));
      }

      // 2. Copy skills
      const skillSrc = path.join(targetDist, "skills", "boost");
      const skillDest = path.join(paths.skillsDir, "boost");
      copyDirRecursive(skillSrc, skillDest);
      filesInstalled.push(path.join(skillDest, "SKILL.md"));

      // 3. Patch opencode.jsonc
      const configFile = path.join(paths.configDir, "opencode.jsonc");
      patchOpenCodeConfig(configFile);
      filesInstalled.push(configFile + " (subagent_depth: 3 & /boost command registered)");
    }

    return {
      harness,
      success: true,
      message: `Successfully installed open-boost for ${paths.name}`,
      filesInstalled,
    };
  } catch (error) {
    return {
      harness,
      success: false,
      message: `Failed to install for ${paths.name}: ${error instanceof Error ? error.message : String(error)}`,
      filesInstalled,
    };
  }
}

/**
 * Checks open-boost status across all harnesses.
 * @returns {Record<HarnessType, { detected: boolean; version?: string; agentsInstalled: number; skillInstalled: boolean; configReady: boolean }>}
 */
export function checkStatus() {
  const harnesses = getHarnessPaths();
  const boostAgents = [
    "boost-coder-coordinator.md",
    "boost-coder-l0.md",
    "boost-coder-improvement.md",
    "boost-investigator-coordinator.md",
    "boost-investigator-l0.md",
    "boost-investigator-improvement.md",
  ];

  const result = {};

  for (const [key, info] of Object.entries(harnesses)) {
    let agentsCount = 0;
    if (fs.existsSync(info.agentsDir)) {
      for (const agent of boostAgents) {
        if (fs.existsSync(path.join(info.agentsDir, agent))) {
          agentsCount++;
        }
      }
    }

    const skillPath = path.join(info.skillsDir, "boost", "SKILL.md");
    const skillInstalled = fs.existsSync(skillPath);

    let configReady = false;
    if (key === "omp") {
      const configPath = path.join(info.configDir, "config.yml");
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf8");
        const depthMatch = content.match(/maxRecursionDepth:\s*(\d+)/);
        configReady = depthMatch ? parseInt(depthMatch[1], 10) >= 3 : false;
      }
    } else if (key === "pi") {
      configReady = fs.existsSync(info.configDir);
    } else if (key === "opencode") {
      const configPath = path.join(info.configDir, "opencode.jsonc");
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, "utf8");
          const conf = JSON.parse(stripJsonComments(content));
          configReady = !!(conf.subagent_depth && conf.subagent_depth >= 3);
        } catch {
          configReady = false;
        }
      }
    }

    result[key] = {
      detected: info.detected,
      version: info.cliVersion,
      agentsInstalled: agentsCount,
      skillInstalled,
      configReady,
    };
  }

  return result;
}
