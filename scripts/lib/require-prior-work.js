import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck, buildNewExampleRequest, selfExtendExampleRequest } from "./prior-work-check.js";

// Shared enforcement: a packet creator may not run without a passing Prior-Work
// Check verdict. Semantics are pinned to the packet kind:
//   - app_build_packet requires verdict build_new
//   - vnext_packet requires verdict extend_existing
// Anything else (missing verdict, blocked_cannot_verify, wrong verdict) refuses
// with a non-zero exit so no path can create a packet by bypassing the gate.

const VERDICT_FOR_PACKET = {
  app_build_packet: "build_new",
  vnext_packet: "extend_existing"
};

export function requirePriorWorkVerdict({ inline, envVar, packetKind, label }) {
  const required = VERDICT_FOR_PACKET[packetKind];
  const loaded = loadArtifact({ inline, envVar });

  if (!loaded) {
    refuse([
      `${label} blocked: a passing Prior-Work Check verdict is required.`,
      `Run \`npm run prior-work:check\` and pass the artifact via ${envVar}=<path> (or input.priorWorkCheck).`,
      "No packet may be created without a passing prior-work verdict. See source-of-truth/prior-work-check-gate.md."
    ]);
  }

  const { artifact, origin } = loaded;

  if (!artifact || artifact.kind !== "prior_work_check") {
    refuse([`${label} blocked: ${origin} is not a prior_work_check artifact.`]);
  }

  if (artifact.passed !== true || artifact.verdict === "blocked_cannot_verify") {
    refuse([
      `${label} blocked: Prior-Work Check did not pass (verdict: ${artifact.verdict ?? "missing"}).`,
      hintFor(artifact.verdict)
    ]);
  }

  if (required && artifact.verdict !== required) {
    refuse([
      `${label} blocked: verdict "${artifact.verdict}" does not authorize a ${packetKind}.`,
      `A ${packetKind} requires verdict: ${required}.`,
      hintFor(artifact.verdict)
    ]);
  }

  // Defense in depth: a build_new verdict that itself recorded registry/loop
  // prior work is contradictory — never let it create a new App Build Packet for
  // something already represented in app_portfolio_registry.
  if (required === "build_new") {
    const search = artifact.registrySearch;
    const registryHits = search ? (search.registeredMatches?.length || 0) + (search.completedLoopMatches?.length || 0) : 0;
    if (registryHits > 0) {
      refuse([
        `${label} blocked: the verdict is build_new but its app_portfolio_registry search found ${registryHits} prior-work match(es).`,
        "Resolve as reuse/extend (vNext) or get an explicit owner decision; a new App Build Packet cannot be created for work already in the registry."
      ]);
    }
  }

  return {
    verdict: artifact.verdict,
    runId: artifact.sourceRequest?.runId ?? "unknown-run",
    targetRepo: artifact.targetRepo?.name ?? "unknown-repo",
    extensionTargets: Array.isArray(artifact.extensionTargets) ? artifact.extensionTargets : [],
    origin
  };
}

function hintFor(verdict) {
  if (verdict === "extend_existing") {
    return "extend_existing authorizes a vNext/repair packet only — run `npm run vnext:packet` against the named existing surfaces.";
  }
  if (verdict === "build_new") {
    return "build_new authorizes a new App Build Packet only — run `npm run packet:create`.";
  }
  if (verdict === "blocked_cannot_verify") {
    return "The target repo could not be read. Make it visible and rerun the Prior-Work Check before any packet.";
  }
  if (verdict === "needs_human_review") {
    return "Prior work is uncertain (partial registry match). Get an explicit reuse-or-build decision before any packet.";
  }
  if (verdict === "blocked_registry_unavailable") {
    return "The app_portfolio_registry lookup failed. Fix the registry and rerun the Prior-Work Check before any packet.";
  }
  return "Run the Prior-Work Check and resolve its verdict before creating a packet.";
}

function loadArtifact({ inline, envVar }) {
  if (inline && typeof inline === "object") {
    return { artifact: inline, origin: "input.priorWorkCheck" };
  }

  const envPath = envVar ? process.env[envVar] : "";
  if (envPath && String(envPath).trim()) {
    const resolved = path.resolve(String(envPath).trim());
    if (!fs.existsSync(resolved)) {
      refuse([`Prior-Work Check artifact not found at ${envVar}=${envPath}.`]);
    }
    try {
      return { artifact: JSON.parse(fs.readFileSync(resolved, "utf8")), origin: envPath };
    } catch {
      refuse([`Prior-Work Check artifact at ${envPath} is not valid JSON.`]);
    }
  }

  return null;
}

function refuse(lines) {
  for (const line of lines) console.error(line);
  process.exit(2);
}

// Test-only helper: generate a real, passing verdict artifact for smokes that
// need to exercise packet creation. Uses the actual gate engine so the verdict
// is genuine, and points only at in-repo paths so it is CI-safe.
export function writeTestVerdict(kind, dir) {
  // Isolate the registry lookup to an empty state root so generated verdicts are
  // deterministic (empty registrySearch) regardless of local .app-engine state.
  if (!process.env.APPENGINE_STATE_ROOT) {
    process.env.APPENGINE_STATE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-verdict-state-"));
  }
  const request = kind === "extend_existing" ? selfExtendExampleRequest() : buildNewExampleRequest();
  const artifact = runPriorWorkCheck(request);
  if (artifact.verdict !== kind) {
    throw new Error(`expected ${kind} test verdict, got ${artifact.verdict}`);
  }
  const filePath = path.join(dir, `prior-work-${kind}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`);
  return filePath;
}
