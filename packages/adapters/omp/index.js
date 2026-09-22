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
import * as path from "node:path";

/**
 * Patches OMP config file to ensure task recursion depth, concurrency, budget, and runtime limits.
 * @param {string} configPath
 * @returns {{ changed: boolean }}
 */
export function patchOmpConfig(configPath) {
  const targets = [
    { key: "maxRecursionDepth", min: 3 },
    { key: "maxConcurrency", min: 4 },
    { key: "softRequestBudget", min: 120 },
    { key: "maxRuntimeMs", min: 1200000 },
  ];

  if (!fs.existsSync(configPath)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const defaultContent = "task:\n  maxRecursionDepth: 3\n  maxConcurrency: 4\n  softRequestBudget: 120\n  maxRuntimeMs: 1200000\n";
    fs.writeFileSync(configPath, defaultContent, "utf8");
    return { changed: true };
  }

  let content = fs.readFileSync(configPath, "utf8");
  let changed = false;

  const lines = content.split(/\r?\n/);
  // Find top-level task block: line starting with "task:" (not indented)
  const taskHeaderIndex = lines.findIndex((line) => /^task:(?:\s*|\s+#.*|\s*\{.*\})$/.test(line));

  if (taskHeaderIndex === -1) {
    const trimmed = content.trimEnd();
    const prefix = trimmed.length > 0 ? "\n" : "";
    content = trimmed + prefix + "\ntask:\n  maxRecursionDepth: 3\n  maxConcurrency: 4\n  softRequestBudget: 120\n  maxRuntimeMs: 1200000\n";
    changed = true;
  } else {
    // Normalize task: {} or task: { ... } to task: if needed
    if (/^task:\s*\{.*\}\s*$/.test(lines[taskHeaderIndex])) {
      lines[taskHeaderIndex] = "task:";
      changed = true;
    }

    // Find the boundary of the task section:
    // Starts at taskHeaderIndex + 1 and continues as long as lines are indented or blank/comment
    let taskEndIndex = lines.length;
    for (let i = taskHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^[a-zA-Z0-9_-]+:/.test(line) || /^---/.test(line)) {
        taskEndIndex = i;
        break;
      }
    }

    // Identify standard indentation inside the task block
    let detectedIndent = "  ";
    for (let i = taskHeaderIndex + 1; i < taskEndIndex; i++) {
      const match = lines[i].match(/^(\s+)[a-zA-Z0-9_-]+:/);
      if (match) {
        detectedIndent = match[1];
        break;
      }
    }

    // Process targets strictly within task block [taskHeaderIndex + 1, taskEndIndex)
    const missing = [];
    for (const { key, min } of targets) {
      let found = false;
      const keyPattern = new RegExp(`^(\\s+)${key}:\\s*['"]?(\\d+)['"]?`);
      for (let i = taskHeaderIndex + 1; i < taskEndIndex; i++) {
        const line = lines[i];
        const match = line.match(keyPattern);
        if (match) {
          found = true;
          const currentVal = parseInt(match[2], 10);
          if (currentVal < min) {
            lines[i] = line.replace(new RegExp(`^(\\s+${key}:\\s*)['"]?\\d+['"]?`), `$1${min}`);
            changed = true;
          }
          break;
        }
      }
      if (!found) {
        missing.push({ key, min });
      }
    }

    if (missing.length > 0) {
      let insertIndex = taskEndIndex;
      while (insertIndex > taskHeaderIndex + 1 && lines[insertIndex - 1].trim() === "") {
        insertIndex--;
      }
      const newLines = missing.map((t) => `${detectedIndent}${t.key}: ${t.min}`);
      lines.splice(insertIndex, 0, ...newLines);
      changed = true;
    }

    if (changed) {
      content = lines.join("\n");
      if (!content.endsWith("\n")) {
        content += "\n";
      }
    }
  }

  if (changed) {
    fs.writeFileSync(configPath, content, "utf8");
  }

  return { changed };
}
