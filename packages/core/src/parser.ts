/**
 * Open-Boost Auto-Healing Report Parser & Skepticism Validator
 *
 * Designed to eliminate model format defects common in lightweight flash models:
 * - Redundant outer code fences (```markdown ... ```)
 * - JSON-wrapped string responses
 * - Missing or corrupted Skepticism Disclaimers
 */

export interface ParsedReport {
  raw: string;
  cleaned: string;
  hasDisclaimer: boolean;
  sections: {
    disclaimer?: string;
    changedOrPrior?: string;
    rationaleOrChanges?: string;
    verificationRecord?: string;
    knownIssuesOrConfidence?: string;
    nextStepsOrGaps?: string;
  };
  hasDeepVerification: boolean;
  knownIssues: Array<{ severity: string; text: string }>;
}

export function cleanReportOutput(text: string): string {
  if (!text) return "";
  let result = text.trim();

  // Strip JSON envelope if flash model accidentally returned {"data": "..."} or {"report": "..."}
  if (result.startsWith("{") && result.endsWith("}")) {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === "string") {
        result = parsed;
      } else if (typeof parsed.data === "string") {
        result = parsed.data;
      } else if (typeof parsed.report === "string") {
        result = parsed.report;
      } else if (typeof parsed.content === "string") {
        result = parsed.content;
      }
    } catch {
      // not valid JSON, proceed with raw text
    }
  }

  // Strip markdown code fence if wrapped in ```markdown ... ``` or ``` ... ```
  const fenceRegex = /^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/i;
  const match = result.match(fenceRegex);
  if (match && match[1]) {
    result = match[1].trim();
  }

  return result;
}

export function parseSkepticismReport(text: string): ParsedReport {
  const cleaned = cleanReportOutput(text);

  const hasDisclaimer = />\s*\[!WARNING\]\s*\*\*Skepticism Disclaimer\*\*/i.test(cleaned);
  const hasDeepVerification = /-\s*\*\*Deep Verification\s*\(ran actual tests\)\s*:\*\*/i.test(cleaned);

  const knownIssues: Array<{ severity: string; text: string }> = [];
  const issueRegex = /-\s*`(Fatal Functional Bug|Shallow Verification|Minor Robustness Risk)`\s*—\s*(.*)/g;
  let issueMatch: RegExpExecArray | null;
  while ((issueMatch = issueRegex.exec(cleaned)) !== null) {
    knownIssues.push({
      severity: issueMatch[1],
      text: issueMatch[2].trim(),
    });
  }

  return {
    raw: text,
    cleaned,
    hasDisclaimer,
    sections: {},
    hasDeepVerification,
    knownIssues,
  };
}
