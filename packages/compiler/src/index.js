import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Compile all targets (OMP, Pi, OpenCode) from core SSOT prompts into outDir.
 * @param {string} rootDir
 * @param {string} outDir
 */
export function buildAll(rootDir, outDir) {
  const promptsDir = path.join(rootDir, "packages", "core", "prompts");

  const orchestrator = fs.readFileSync(path.join(promptsDir, "orchestrator.md"), "utf8");
  const coderCoord = fs.readFileSync(path.join(promptsDir, "boost-coder-coordinator.md"), "utf8");
  const coderL0 = fs.readFileSync(path.join(promptsDir, "boost-coder-l0.md"), "utf8");
  const coderImp = fs.readFileSync(path.join(promptsDir, "boost-coder-improvement.md"), "utf8");
  const investCoord = fs.readFileSync(path.join(promptsDir, "boost-investigator-coordinator.md"), "utf8");
  const investL0 = fs.readFileSync(path.join(promptsDir, "boost-investigator-l0.md"), "utf8");
  const investImp = fs.readFileSync(path.join(promptsDir, "boost-investigator-improvement.md"), "utf8");

  // 1. Build OMP target
  const ompSkillsDir = path.join(outDir, "omp", "skills", "boost");
  const ompAgentsDir = path.join(outDir, "omp", "agents");
  fs.mkdirSync(ompSkillsDir, { recursive: true });
  fs.mkdirSync(ompAgentsDir, { recursive: true });

  fs.writeFileSync(path.join(ompSkillsDir, "SKILL.md"), orchestrator);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-coder-coordinator.md"), coderCoord);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-coder-l0.md"), coderL0);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-coder-improvement.md"), coderImp);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-investigator-coordinator.md"), investCoord);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-investigator-l0.md"), investL0);
  fs.writeFileSync(path.join(ompAgentsDir, "boost-investigator-improvement.md"), investImp);

  // 2. Build Pi target
  const piAgentsDir = path.join(outDir, "pi", "agents");
  const piSkillsDir = path.join(outDir, "pi", "skills", "boost");
  const piExtDir = path.join(outDir, "pi", "extensions");
  fs.mkdirSync(piAgentsDir, { recursive: true });
  fs.mkdirSync(piSkillsDir, { recursive: true });
  fs.mkdirSync(piExtDir, { recursive: true });

  // In Pi, coordinators allow nested subagents
  const piCoderCoord = coderCoord.replace(
    /tools: \[\]/,
    `tools: []\nallowNestedSubagents: true\nallowedAgents:\n  - boost-coder-l0\n  - boost-coder-improvement`
  );
  const piInvestCoord = investCoord.replace(
    /tools: \[\]/,
    `tools: []\nallowNestedSubagents: true\nallowedAgents:\n  - boost-investigator-l0\n  - boost-investigator-improvement`
  );

  fs.writeFileSync(path.join(piSkillsDir, "SKILL.md"), orchestrator);
  fs.writeFileSync(path.join(piAgentsDir, "boost-coder-coordinator.md"), piCoderCoord);
  fs.writeFileSync(path.join(piAgentsDir, "boost-coder-l0.md"), coderL0);
  fs.writeFileSync(path.join(piAgentsDir, "boost-coder-improvement.md"), coderImp);
  fs.writeFileSync(path.join(piAgentsDir, "boost-investigator-coordinator.md"), piInvestCoord);
  fs.writeFileSync(path.join(piAgentsDir, "boost-investigator-l0.md"), investL0);
  fs.writeFileSync(path.join(piAgentsDir, "boost-investigator-improvement.md"), investImp);

  // Copy or generate Pi extension (both .js and .ts supported)
  const piExtensionSourceJs = path.join(rootDir, "packages", "adapters", "pi", "index.js");
  const piExtensionSourceTs = path.join(rootDir, "packages", "adapters", "pi", "index.ts");
  if (fs.existsSync(piExtensionSourceJs)) {
    fs.copyFileSync(piExtensionSourceJs, path.join(piExtDir, "open-boost.js"));
  }
  if (fs.existsSync(piExtensionSourceTs)) {
    fs.copyFileSync(piExtensionSourceTs, path.join(piExtDir, "open-boost.ts"));
  }

  // 3. Build OpenCode target
  const ocAgentsDir = path.join(outDir, "opencode", "agents");
  const ocSkillsDir = path.join(outDir, "opencode", "skills", "boost");
  const ocCmdsDir = path.join(outDir, "opencode", "commands");
  fs.mkdirSync(ocAgentsDir, { recursive: true });
  fs.mkdirSync(ocSkillsDir, { recursive: true });
  fs.mkdirSync(ocCmdsDir, { recursive: true });
  // OpenCode uses mode: subagent and object-based tools schema
  const ocCoderCoord = coderCoord
    .replace(/^---/, `---\nmode: subagent`)
    .replace(/tools: \[\]/, `tools: {}`);

  const ocInvestCoord = investCoord
    .replace(/^---/, `---\nmode: subagent`)
    .replace(/tools: \[\]/, `tools: {}`);

  const ocCoderL0 = coderL0
    .replace(/^---/, `---\nmode: subagent`);

  const ocCoderImp = coderImp
    .replace(/^---/, `---\nmode: subagent`);

  const ocInvestL0 = investL0
    .replace(/^---/, `---\nmode: subagent`)
    .replace(/tools:\s*\[[\s\S]*?\]/, `tools:\n  read: true\n  grep: true\n  glob: true\n  lsp: true\n  ast_grep: true\n  bash: true`);

  const ocInvestImp = investImp
    .replace(/^---/, `---\nmode: subagent`)
    .replace(/tools:\s*\[[\s\S]*?\]/, `tools:\n  read: true\n  grep: true\n  glob: true\n  lsp: true\n  ast_grep: true\n  bash: true`);

  fs.writeFileSync(path.join(ocSkillsDir, "SKILL.md"), orchestrator);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-coder-coordinator.md"), ocCoderCoord);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-coder-l0.md"), ocCoderL0);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-coder-improvement.md"), ocCoderImp);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-investigator-coordinator.md"), ocInvestCoord);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-investigator-l0.md"), ocInvestL0);
  fs.writeFileSync(path.join(ocAgentsDir, "boost-investigator-improvement.md"), ocInvestImp);

  // OpenCode config patch & command
  const ocPatch = {
    subagent_depth: 3,
    command: {
      boost: {
        template: "You are the Boost Orchestrator. Execute the task using the Boost delegation pipeline according to the rules in ~/.config/opencode/skills/boost/SKILL.md.\n\nTask: $ARGUMENTS",
        description: "Boost deep reasoning adversarial multi-agent pipeline",
        subtask: false
      }
    }
  };
  fs.writeFileSync(path.join(outDir, "opencode", "opencode.patch.jsonc"), JSON.stringify(ocPatch, null, 2));
  fs.writeFileSync(path.join(ocCmdsDir, "boost.json"), JSON.stringify(ocPatch.command.boost, null, 2));

  return { success: true, outDir };
}
