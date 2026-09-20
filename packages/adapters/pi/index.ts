/**
 * Open-Boost Pi Extension
 *
 * Registers the /boost slash command for Pi Coding Agent.
 * Intercepts /boost <task>, prepares the high-fidelity prompt, and invokes
 * the adversarial multi-agent pipeline (boost-coder-coordinator or boost-investigator-coordinator).
 */

export interface ExtensionCommandContext {
  hasUI?: boolean;
  ui?: {
    setStatus?: (key: string, text: string | undefined) => void;
    notify?: (message: string, level?: "info" | "warning" | "error") => void;
  };
  sendUserMessage?: (message: string) => Promise<void>;
}

export interface ExtensionAPI {
  on?: (event: string, handler: (event: unknown, ctx: ExtensionCommandContext) => Promise<void> | void) => void;
  registerCommand?: (
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;
    }
  ) => void;
  sendUserMessage?: (message: string) => Promise<void>;
  sendMessage?: (message: {
    role?: string;
    content: Array<{ type: string; text: string }>;
    display?: boolean;
  }) => Promise<void>;
}

export default function registerOpenBoostExtension(pi: ExtensionAPI): void {
  pi.on?.("session_start", async (_event: unknown, ctx: ExtensionCommandContext) => {
    if (ctx?.hasUI) {
      ctx.ui?.setStatus?.("open-boost", "⚡ Boost ready");
    }
  });

  pi.registerCommand?.("boost", {
    description: "Run task through open-boost adversarial multi-agent pipeline",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const task = (args || "").trim();
      if (!task) {
        if (ctx?.hasUI) {
          ctx.ui?.notify?.("Usage: /boost <task>", "error");
        } else {
          console.error("Usage: /boost <task>");
        }
        return;
      }

      const isInvestigation = /\b(why|investigate|audit|trace|root cause|diagnose|find bug|analysis)\b/i.test(task);
      const targetCoordinator = isInvestigation ? "boost-investigator-coordinator" : "boost-coder-coordinator";

      if (ctx?.hasUI) {
        ctx.ui?.setStatus?.("open-boost", `⚡ Boost delegating to ${targetCoordinator}...`);
        ctx.ui?.notify?.(`[Open-Boost] Delegating to ${targetCoordinator}`, "info");
      }

      const prompt = [
        `When the user invokes /boost, execute the task under the Boost orchestrator rules.`,
        ``,
        `Task: ${task}`,
        ``,
        `Routines: Delegation Routine.`,
        `Spawn coordinator: ${targetCoordinator} using the subagent tool ({ agent: "${targetCoordinator}", task: "..." }).`,
        `Follow strictly the Skepticism Reporting Protocol.`
      ].join("\n");

      // Deliver message into the active conversation session
      if (typeof ctx?.sendUserMessage === "function") {
        await ctx.sendUserMessage(prompt);
      } else if (typeof pi.sendUserMessage === "function") {
        await pi.sendUserMessage(prompt);
      } else if (typeof pi.sendMessage === "function") {
        await pi.sendMessage({
          role: "user",
          content: [{ type: "text", text: prompt }],
          display: true,
        });
      }
    },
  });
}
