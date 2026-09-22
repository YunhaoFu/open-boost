/**
 * Open-Boost OMP Adapter
 *
 * Configures Oh My Pi (OMP) to support Boost:
 * 1. Ensures task.maxRecursionDepth >= 3, task.maxConcurrency >= 4,
 *    task.softRequestBudget >= 120, and task.maxRuntimeMs >= 1200000
 *    in ~/.omp/agent/config.yml
 * 2. Installs skill and 6 agent markdown definitions
 */

import * as fs from "node:fs";

/**
 * Patches OMP config file to ensure task recursion depth, concurrency, budget, and runtime limits.
 * @param {string} configPath
 * @returns {{ changed: boolean }}
 */
export function patchOmpConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { changed: false };
  }

  let content = fs.readFileSync(configPath, "utf8");
  let changed = false;

  const targets = [
    { key: "maxRecursionDepth", min: 3 },
    { key: "maxConcurrency", min: 4 },
    { key: "softRequestBudget", min: 120 },
    { key: "maxRuntimeMs", min: 1200000 },
  ];

  if (/^task:/m.test(content)) {
    const missing = [];
    for (const { key, min } of targets) {
      const keyRegex = new RegExp(`^(\\s+)${key}:\\s*(\\d+)`, "m");
      const match = content.match(keyRegex);
      if (match) {
        const currentVal = parseInt(match[2], 10);
        if (currentVal < min) {
          content = content.replace(keyRegex, `$1${key}: ${min}`);
          changed = true;
        }
      } else {
        missing.push({ key, min });
      }
    }
    if (missing.length > 0) {
      const addition = missing.map((t) => `\n  ${t.key}: ${t.min}`).join("");
      content = content.replace(/^task:.*$/m, `$&${addition}`);
      changed = true;
    }
  } else {
    content += "\ntask:\n  maxRecursionDepth: 3\n  maxConcurrency: 4\n  softRequestBudget: 120\n  maxRuntimeMs: 1200000\n";
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(configPath, content, "utf8");
  }

  return { changed };
}
