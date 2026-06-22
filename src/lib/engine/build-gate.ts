import { getLocalProject } from "@/lib/engine/development-store";
import { isLocalMode } from "@/lib/engine/local-mode";

// Build gate (guardrail, not a feature).
//
// The legacy idea -> project -> run -> generate path must not produce or prepare
// a build unless the request has already passed the canonical gate:
//   problem_intake_gate -> clarification -> prior_work_check.
//
// A project carries that clearance in `gateClearance`. No current project sets
// it, so this gate fails closed for the legacy path until a gated handoff
// attaches clearance — exactly the intended behavior. The canonical build path
// (packet chain -> GitHub) is unaffected; it does not use these functions.

export type BuildGateClearance = {
  intakeGateId?: string;
  clarified?: boolean;
  priorWork?: { verdict?: string; passed?: boolean };
};

export type BuildGateVerdict = { allowed: boolean; reason: string };

const ALLOWED_VERDICTS = ["build_new", "extend_existing"];

const REROUTE_MESSAGE =
  "Build blocked: this request has not passed the canonical gate. Route it through " +
  "problem_intake_gate -> clarification -> prior_work_check before any build, plan execution, " +
  "app generation, or deployment preparation. The legacy idea->build path is planning-only.";

export class BuildGateError extends Error {
  code = "BUILD_GATE_BLOCKED";
  reason: string;
  action: string;

  constructor(message: string, reason: string, action: string) {
    super(message);
    this.name = "BuildGateError";
    this.reason = reason;
    this.action = action;
  }
}

export function isBuildGateError(value: unknown): value is BuildGateError {
  return value instanceof Error && value.name === "BuildGateError";
}

export function evaluateBuildGate(clearance: BuildGateClearance | null | undefined): BuildGateVerdict {
  if (!clearance) return { allowed: false, reason: "no_gate_clearance" };
  if (!clearance.intakeGateId) return { allowed: false, reason: "missing_problem_intake_gate_reference" };
  if (clearance.clarified !== true) return { allowed: false, reason: "missing_clarification" };

  const priorWork = clearance.priorWork;
  if (!priorWork || priorWork.passed !== true || !ALLOWED_VERDICTS.includes(priorWork.verdict ?? "")) {
    return { allowed: false, reason: "missing_passing_prior_work_check" };
  }

  return { allowed: true, reason: "gated" };
}

export async function loadProjectGateClearance(projectId: string): Promise<BuildGateClearance | null> {
  if (isLocalMode()) {
    const project = (await getLocalProject(projectId)) as ({ gateClearance?: BuildGateClearance } | null);
    return project?.gateClearance ?? null;
  }

  // Durable (DB) clearance requires a future approved migration to persist a
  // gate-clearance column. Until then, the DB-backed legacy build fails closed.
  return null;
}

export async function assertProjectBuildAllowed(projectId: string, action: string): Promise<void> {
  const clearance = await loadProjectGateClearance(projectId);
  const verdict = evaluateBuildGate(clearance);

  if (!verdict.allowed) {
    throw new BuildGateError(`${REROUTE_MESSAGE} (action: ${action}, reason: ${verdict.reason})`, verdict.reason, action);
  }
}
