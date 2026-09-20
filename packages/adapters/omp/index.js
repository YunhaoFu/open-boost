/**
 * Open-Boost OMP Adapter
 *
 * Configures Oh My Pi (OMP) to support Boost:
 * 1. Ensures task.maxRecursionDepth >= 3 in ~/.omp/agent/config.yml
 * 2. Installs skill and 6 agent markdown definitions
 */

import * as fs from "node:fs";

/**
 * Patches OMP config file to ensure maxRecursionDepth is >= 3.
 * @param {string} configPath
 * @returns {{ changed: boolean }}
 */
export function patchOmpConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { changed: false };
  }

  let content = fs.readFileSync(configPath, "utf8");
  let changed = false;

  // Check if maxRecursionDepth is present
  const depthMatch = content.match(/maxRecursionDepth:\s*(\d+)/);
  if (depthMatch) {
    const currentDepth = parseInt(depthMatch[1], 10);
    if (currentDepth < 3) {
      content = content.replace(/maxRecursionDepth:\s*\d+/, "maxRecursionDepth: 3");
      changed = true;
    }
  } else {
    // Inject into task section or at root
    if (/^task:/m.test(content)) {
      content = content.replace(/^task:.*$/m, "$&\n  maxRecursionDepth: 3");
      changed = true;
    } else {
      content += "\ntask:\n  maxRecursionDepth: 3\n  maxConcurrency: 4\n";
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(configPath, content, "utf8");
  }

  return { changed };
}
