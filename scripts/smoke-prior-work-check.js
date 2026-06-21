import {
  runPriorWorkCheck,
  run001ExampleRequest,
  unreachableRepoExampleRequest,
  buildNewExampleRequest
} from "./lib/prior-work-check.js";

runStep("can't-see-the-repo blocks instead of allowing a build", () => {
  const artifact = runPriorWorkCheck(unreachableRepoExampleRequest());
  assertEqual(artifact.verdict, "blocked_cannot_verify", "verdict");
  assertEqual(artifact.passed, false, "passed");
  assertEqual(artifact.targetRepo.visible, false, "targetRepo.visible");
  assertEqual(artifact.decision.proceed, false, "decision.proceed");
  assertTrue(artifact.blocking === true, "gate is blocking");
});

runStep("RUN-001 returns extend_existing against the real ChurchConnect repo", () => {
  const artifact = runPriorWorkCheck(run001ExampleRequest());

  if (!artifact.targetRepo.visible) {
    throw new Error(
      `ChurchConnect repo was not visible; tried: ${artifact.targetRepo.triedPaths.join(", ")}. ` +
        "Prior-Work Check correctly blocks, but this smoke expects the repo to be readable from production-app."
    );
  }

  assertEqual(artifact.verdict, "extend_existing", "verdict");
  assertEqual(artifact.passed, true, "passed");

  // It must point at the existing surfaces, not a new build.
  assertExtensionTarget(artifact, "visitor-capture-form", "VisitorRegistration");
  assertExtensionTarget(artifact, "admin-follow-up-list", "ConnectionInbox");
  assertMigrationTarget(artifact, "persistent-follow-up-state", "connection_cards");

  // Both admin surfaces must be flagged, including the connection_cards reader.
  for (const fragment of ["VisitorRegistration.tsx", "ConnectionInbox.tsx", "ConnectionCards.tsx"]) {
    assertTrue(
      artifact.extensionTargets.some((target) => target.path.includes(fragment)),
      `extension target points at ${fragment}`
    );
  }

  // The real ChurchConnect bug: ConnectionInbox reads connection_inbox while
  // ConnectionCards reads connection_cards. The gate must flag that split.
  assertTrue(
    artifact.findings.some(
      (finding) =>
        finding.kind === "table_split" &&
        finding.tables.includes("connection_inbox") &&
        finding.tables.includes("connection_cards")
    ),
    "connection_inbox vs connection_cards split is flagged"
  );

  // Side-door rule: every proposed new parallel surface is flagged.
  assertTrue(artifact.sideDoorViolations.length >= 3, "all proposed side doors flagged");
  for (const id of ["visitor-capture-form", "admin-follow-up-list", "persistent-follow-up-state"]) {
    assertTrue(
      artifact.sideDoorViolations.some((violation) => violation.capabilityId === id && violation.rule === "side_door_forbidden"),
      `side-door violation recorded for ${id}`
    );
  }

  // Evidence-validated: every prior-work claim carries a concrete pointer.
  for (const cap of artifact.capabilities) {
    assertTrue(cap.priorWorkFound === true, `prior work found for ${cap.id}`);
    assertTrue(cap.evidence.length > 0, `evidence present for ${cap.id}`);
    for (const item of cap.evidence) {
      assertTrue(Boolean(item.path), `evidence path present for ${cap.id}`);
    }
  }
});

runStep("verified-no-prior-work returns build_new", () => {
  const artifact = runPriorWorkCheck(buildNewExampleRequest());
  assertEqual(artifact.targetRepo.visible, true, "targetRepo.visible");
  assertEqual(artifact.verdict, "build_new", "verdict");
  assertEqual(artifact.passed, true, "passed");
  assertEqual(artifact.sideDoorViolations.length, 0, "no side doors when nothing pre-exists");
});

runStep("guardrails keep the gate read-only and blocking", () => {
  const artifact = runPriorWorkCheck(run001ExampleRequest());
  for (const key of [
    "blockingGate",
    "readOnly",
    "cannotSeeRepoBlocks",
    "sideDoorForbidden",
    "evidenceRequired",
    "crossRepo",
    "noTargetRepoWrites",
    "noMigrationsExecuted"
  ]) {
    assertEqual(artifact.guardrails[key], true, `guardrails.${key}`);
  }
});

console.log("prior-work-check smoke ok");

function assertExtensionTarget(artifact, capabilityId, expectedPathFragment) {
  const target = artifact.extensionTargets.find((item) => item.capabilityId === capabilityId);
  if (!target) throw new Error(`expected an extension target for ${capabilityId}`);
  if (!target.path.includes(expectedPathFragment)) {
    throw new Error(`extension target for ${capabilityId} should point at ${expectedPathFragment}, got ${target.path}`);
  }
}

function assertMigrationTarget(artifact, capabilityId, expectedTable) {
  const target = artifact.extensionTargets.find((item) => item.capabilityId === capabilityId);
  if (!target) throw new Error(`expected an extension target for ${capabilityId}`);
  if (target.kind !== "migration") throw new Error(`expected a migration target for ${capabilityId}, got ${target.kind}`);
  if (target.table !== expectedTable) {
    throw new Error(`migration target for ${capabilityId} should reference ${expectedTable}, got ${target.table}`);
  }
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} should be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}
