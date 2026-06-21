// Gate evidence for the GitHub build path.
//
// A Codex build prompt (agent mode "builder", i.e. the ai:build label) may only
// be generated when the issue/handoff already references a valid problem_intake_gate
// packet AND a passed prior_work_check (verdict build_new or extend_existing).
// Otherwise generation must fail closed.

const ALLOWED_VERDICTS = ["build_new", "extend_existing"];

export function hasGatePacketReference(text) {
  const value = String(text || "");
  return (
    /problem_intake_gate/i.test(value) ||
    /\bgate[\s_-]?packet\b/i.test(value) ||
    /"kind"\s*:\s*"problem_intake_gate"/i.test(value)
  );
}

export function hasPriorWorkApproval(text) {
  const value = String(text || "").toLowerCase();
  if (!/prior[\s_-]?work[\s_-]?check/.test(value)) return false;

  const hasVerdict = ALLOWED_VERDICTS.some((verdict) => value.includes(verdict));
  if (!hasVerdict) return false;

  const passed =
    /"passed"\s*:\s*true/.test(value) ||
    /passed\s*[:=]\s*true/.test(value) ||
    /prior[\s_-]?work[\s_-]?check[^a-z]{0,12}(passed|approved)/.test(value) ||
    /(passed|approved)[^a-z]{0,12}prior[\s_-]?work[\s_-]?check/.test(value);

  return passed;
}

export function evaluateBuildPromptGate({ mode, taskBody, env = {} }) {
  if (mode !== "builder") {
    return { allowed: true, reason: "non_build_mode" };
  }

  const sources = [taskBody, env.PRIOR_WORK_VERDICT, env.PRIOR_WORK_CHECK, env.GATE_PACKET]
    .filter(Boolean)
    .join("\n");

  const gate = hasGatePacketReference(sources);
  const priorWork = hasPriorWorkApproval(sources);

  if (gate && priorWork) {
    return { allowed: true, reason: "gated" };
  }

  return {
    allowed: false,
    reason: !gate ? "missing_gate_packet_reference" : "missing_prior_work_check_approval"
  };
}

export function assertBuildPromptGate(args) {
  const verdict = evaluateBuildPromptGate(args);
  if (!verdict.allowed) {
    const error = new Error(
      `Codex build prompt blocked: ${verdict.reason}. An ai:build issue must reference a valid problem_intake_gate ` +
        "packet with a passed prior_work_check (build_new or extend_existing) before a build prompt is generated. " +
        "Route the request through problem_intake_gate -> clarification -> prior_work_check first, or relabel ai:plan."
    );
    error.code = "BUILD_PROMPT_GATE_BLOCKED";
    throw error;
  }
  return verdict;
}
