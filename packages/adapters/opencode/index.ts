/**
 * Open-Boost OpenCode Adapter
 *
 * Configures OpenCode to support the 3-tier Boost pipeline:
 * 1. subagent_depth: 3 (enables coordinator -> worker nesting)
 * 2. command: { boost: { template: "...", description: "..." } }
 * 3. installs agents and skills into ~/.config/opencode/
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface OpenCodeConfig {
  subagent_depth?: number;
  command?: Record<string, {
    template: string;
    description: string;
    agent?: string;
    subtask?: boolean;
  }>;
  [key: string]: unknown;
}

export function patchOpenCodeConfig(configPath: string): { changed: boolean; config: OpenCodeConfig } {
  let config: OpenCodeConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf8");
      // strip comments if JSONC
      const jsonContent = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      config = JSON.parse(jsonContent);
    } catch {
      config = {};
    }
  }

  let changed = false;

  // 1. Ensure subagent_depth is at least 3
  if (!config.subagent_depth || config.subagent_depth < 3) {
    config.subagent_depth = 3;
    changed = true;
  }

  // 2. Ensure command.boost is defined
  if (!config.command) {
    config.command = {};
    changed = true;
  }

  if (!config.command.boost) {
    config.command.boost = {
      template: "You are the Boost Orchestrator. Execute the task under the Boost pipeline rules in ~/.config/opencode/skills/boost/SKILL.md.\n\nTask: $ARGUMENTS",
      description: "Boost deep reasoning adversarial multi-agent pipeline",
      subtask: false,
    };
    changed = true;
  }

  if (changed) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  }

  return { changed, config };
}
