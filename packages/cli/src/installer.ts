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
import { patchOpenCodeConfig } from "../../adapters/opencode/index.js";
import { patchOmpConfig } from "../../adapters/omp/index.js";

export type HarnessType = "omp" | "pi" | "opencode";

export interface HarnessInfo {
  type: HarnessType;
  name: string;
  detected: boolean;
  cliVersion?: string;
  configDir: string;
  agentsDir: string;
  skillsDir: string;
  extensionsDir?: string;
}

export function getHarnessPaths(): Record<HarnessType, HarnessInfo> {
  const home = os.homedir();
  const isWindows = process.platform === "win32";

  // OMP paths
  const ompConfigDir = path.join(home, ".omp", "agent");
  const ompInfo: HarnessInfo = {
    type: "omp",
    name: "Oh My Pi (OMP)",
    detected: false,
    configDir: ompConfigDir,
    agentsDir: path.join(ompConfigDir, "agents"),
    skillsDir: path.join(ompConfigDir, "skills"),
  };

  // Pi paths
  const piConfigDir = path.join(home, ".pi", "agent");
  const piInfo: HarnessInfo = {
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
  const opencodeInfo: HarnessInfo = {
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

export function copyDirRecursive(src: string, dest: string) {
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

export interface InstallResult {
  harness: HarnessType;
  success: boolean;
  message: string;
  filesInstalled: string[];
}

export function installHarness(
  harness: HarnessType,
  distDir: string,
  paths: HarnessInfo
): InstallResult {
  const filesInstalled: string[] = [];
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
      filesInstalled.push(configFile + " (recursion depth verified >= 3)");
    } else if (harness === "pi") {
      // 1. Copy extension
      const extSrc = path.join(targetDist, "extensions", "open-boost.ts");
      if (fs.existsSync(extSrc) && paths.extensionsDir) {
        fs.mkdirSync(paths.extensionsDir, { recursive: true });
        const extDest = path.join(paths.extensionsDir, "open-boost.ts");
        fs.copyFileSync(extSrc, extDest);
        filesInstalled.push(extDest);
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

export interface HarnessStatus {
  detected: boolean;
  version?: string;
  agentsInstalled: number;
  skillInstalled: boolean;
  configReady: boolean;
}

export function checkStatus(): Record<HarnessType, HarnessStatus> {
  const harnesses = getHarnessPaths();
  const boostAgents = [
    "boost-coder-coordinator.md",
    "boost-coder-l0.md",
    "boost-coder-improvement.md",
    "boost-investigator-coordinator.md",
    "boost-investigator-l0.md",
    "boost-investigator-improvement.md",
  ];

  const result: Record<HarnessType, HarnessStatus> = {
    omp: { detected: false, agentsInstalled: 0, skillInstalled: false, configReady: false },
    pi: { detected: false, agentsInstalled: 0, skillInstalled: false, configReady: false },
    opencode: { detected: false, agentsInstalled: 0, skillInstalled: false, configReady: false },
  };

  for (const [key, info] of Object.entries(harnesses)) {
    const type = key as HarnessType;
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
    if (type === "omp") {
      const cfg = path.join(info.configDir, "config.yml");
      if (fs.existsSync(cfg)) {
        const text = fs.readFileSync(cfg, "utf8");
        configReady = /maxRecursionDepth:\s*([3-9]|\d{2,})/.test(text);
      }
    } else if (type === "pi") {
      const ext = path.join(info.configDir, "extensions", "open-boost.ts");
      configReady = fs.existsSync(ext);
    } else if (type === "opencode") {
      const cfg = path.join(info.configDir, "opencode.jsonc");
      if (fs.existsSync(cfg)) {
        try {
          const text = fs.readFileSync(cfg, "utf8").replace(/\/\/.*$/gm, "");
          const parsed = JSON.parse(text) as { subagent_depth?: number; command?: { boost?: unknown } };
          configReady = ((parsed.subagent_depth ?? 0) >= 3) && Boolean(parsed.command?.boost);
        } catch {
          configReady = false;
        }
      }
    }

    result[type] = {
      detected: info.detected,
      version: info.cliVersion,
      agentsInstalled: agentsCount,
      skillInstalled,
      configReady,
    };
  }

  return result;
}
