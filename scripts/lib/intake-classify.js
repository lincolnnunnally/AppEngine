// Canonical intake classification (shared, headless port).
//
// This mirrors the classification in src/lib/engine/problem-intake-gate.ts
// (classifyRequestType / inferLikelyApp / solutionPathFor / nextPhaseFor /
// collectMissingContext). The TS gate is the runtime canonical; this JS port lets
// headless paths (create-intake-packet.js) produce the SAME request type and next
// safe phase. The parity contract is verified by smoke-intake-consolidation.js.
// If you change the gate's classification, change this file and the parity smoke.

const REQUEST_TYPES = [
  "problem",
  "opportunity",
  "app_idea",
  "feature_request",
  "improvement_request",
  "fix",
  "ambiguous"
];

const KNOWN_ECOSYSTEM_APPS = [
  "ChurchConnect",
  "Spark of Hope",
  "Live On Mission",
  "Best Life",
  "Kindred",
  "United Under God",
  "Toner Management",
  "Opportunity"
];

export function classifyRequestType(rawRequest, explicit) {
  const requested = typeof explicit === "string" ? explicit.trim() : "";
  if (REQUEST_TYPES.includes(requested) && requested !== "ambiguous") {
    return requested;
  }

  const text = String(rawRequest || "").toLowerCase();
  if (/\b(fix|bug|broken|crash|error|not working|regression|fails?)\b/.test(text)) return "fix";
  if (/\b(improve|improvement|easier|better|polish|refine|enhance|clean ?up|streamline)\b/.test(text)) return "improvement_request";
  if (/\b(add|feature|support for|ability to|allow (?:users|people) to|new option|integrate)\b/.test(text)) return "feature_request";
  if (/\b(build|create|launch|app idea|an app|new app|tool that|platform|website|system to)\b/.test(text)) return "app_idea";
  if (/\bopportunit/.test(text)) return "opportunity";
  if (/\b(problem|struggle|can'?t|cannot|need help|pain|frustrat|hard to|keep(?:s)? (?:dropping|missing|losing))\b/.test(text)) {
    return "problem";
  }
  return "ambiguous";
}

export function inferLikelyApp({ rawRequest, appName, knownApps = [], requestType }) {
  const explicitName = cleanText(appName);
  if (explicitName) {
    return { name: explicitName, slug: slugify(explicitName), status: "existing" };
  }

  const haystack = String(rawRequest || "").toLowerCase();
  const candidates = [...knownApps.map(cleanText).filter(Boolean), ...KNOWN_ECOSYSTEM_APPS];
  for (const candidate of candidates) {
    if (candidate && haystack.includes(candidate.toLowerCase())) {
      return { name: candidate, slug: slugify(candidate), status: "existing" };
    }
  }

  if (requestType === "app_idea" || requestType === "opportunity") {
    const name = deriveAppName(rawRequest);
    return { name, slug: slugify(name), status: "new" };
  }

  return { name: "unknown", slug: "unknown", status: "unknown" };
}

function solutionPathFor(requestType, likelyApp) {
  if (
    likelyApp.status === "existing" ||
    requestType === "feature_request" ||
    requestType === "improvement_request" ||
    requestType === "fix"
  ) {
    return "existing_app_improvement";
  }
  if (likelyApp.status === "new" || requestType === "app_idea") {
    return "new_app";
  }
  return "clarify_first";
}

function collectMissingContext({ problemBeingSolved, intendedPerson, requestType, likelyApp }) {
  const missing = [];
  if (cleanText(problemBeingSolved).length < 8) missing.push("problem being solved");
  if (cleanText(intendedPerson).length < 3) missing.push("intended person/customer");
  if (requestType === "ambiguous") missing.push("request type");
  if (likelyApp.status === "unknown") missing.push("which existing app this affects, or whether it is a new app");
  return missing;
}

function nextPhaseFor(status, path) {
  if (status === "needs_clarification" || path === "clarify_first") return "clarify_problem";
  return "prior_work_check";
}

// Single entry point used by headless intake paths.
export function classifyIntake(input = {}) {
  const rawRequest = cleanText(input.rawRequest);
  const requestType = classifyRequestType(rawRequest, input.requestType);
  const likelyApp = inferLikelyApp({
    rawRequest,
    appName: input.appName,
    knownApps: Array.isArray(input.knownApps) ? input.knownApps : [],
    requestType
  });
  const path = solutionPathFor(requestType, likelyApp);
  const missingContext = collectMissingContext({
    problemBeingSolved: input.problemBeingSolved,
    intendedPerson: input.intendedPerson,
    requestType,
    likelyApp
  });
  const status = missingContext.length ? "needs_clarification" : "scoped";
  const nextSafePhase = nextPhaseFor(status, path);

  return { requestType, likelyApp, status, nextSafePhase, missingContext };
}

function deriveAppName(rawRequest) {
  const words = String(rawRequest || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  return words || "New App";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
  return slug || "intake";
}
