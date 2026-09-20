/**
 * Open-Boost Pi Extension
 *
 * Registers the /boost slash command for Pi Coding Agent.
 * Intercepts /boost <task>, prepares the high-fidelity prompt, and invokes
 * the adversarial multi-agent pipeline (boost-coder-coordinator or boost-investigator-coordinator).
 */

export default function registerOpenBoostExtension(pi) {
  if (typeof pi?.on === "function") {
    pi.on("session_start", async (_event, ctx) => {
      if (ctx?.hasUI && typeof ctx.ui?.setStatus === "function") {
        ctx.ui.setStatus("open-boost", "⚡ Boost ready");
      }
    });
  }

  if (typeof pi?.registerCommand === "function") {
    pi.registerCommand("boost", {
      description: "Run task through open-boost adversarial multi-agent pipeline",
      handler: async (args, ctx) => {
        const task = (args || "").trim();
        if (!task) {
          if (ctx?.hasUI && typeof ctx.ui?.notify === "function") {
            ctx.ui.notify("Usage: /boost <task>", "error");
          } else {
            console.error("Usage: /boost <task>");
          }
          return;
        }

        const isInvestigation = /\b(why|investigate|audit|trace|root cause|diagnose|find bug|analysis)\b/i.test(task);
        const targetCoordinator = isInvestigation ? "boost-investigator-coordinator" : "boost-coder-coordinator";

        if (ctx?.hasUI) {
          if (typeof ctx.ui?.setStatus === "function") {
            ctx.ui.setStatus("open-boost", `⚡ Boost delegating to ${targetCoordinator}...`);
          }
          if (typeof ctx.ui?.notify === "function") {
            ctx.ui.notify(`[Open-Boost] Delegating to ${targetCoordinator}`, "info");
          }
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
}
