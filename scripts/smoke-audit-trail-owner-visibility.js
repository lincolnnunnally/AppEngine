import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("owner visibility report filters private fields", () => {
  assertFileIncludes("src/lib/engine/audit-trail-owner-visibility.ts", [
    "audit_trail_owner_visibility",
    "safe_for_owner_review",
    "privateFieldsFiltered",
    "metadataPreview",
    "sensitiveMetadataPattern",
    "local_mock_jsonl"
  ]);
});

runStep("owner API is admin gated and read-only", () => {
  assertFileIncludes("src/app/api/engine/audit-trail/route.ts", [
    "canAccessEngineAdmin",
    "loadAuditTrailOwnerVisibilityReport",
    "only reads filtered local/mock audit events",
    "never triggers Codex",
    "creates GitHub issues",
    "applies labels"
  ]);
});

runStep("owner control center exposes audit trail section", () => {
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    'data-testid="audit-trail-owner-visibility"',
    "Audit Trail",
    "safe status",
    "Private fields filtered",
    "Refresh Audit Trail"
  ]);
});

runStep("owner page loads audit report server-side", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "loadAuditTrailOwnerVisibilityReport",
    "initialAuditTrailReport"
  ]);
});

runStep("source of truth documents privacy and guardrails", () => {
  assertFileIncludes("source-of-truth/audit-trail-owner-visibility.md", [
    "Audit Trail Owner Visibility",
    "Sensitive/private fields are filtered before display",
    "local_mock_jsonl",
    "trigger Codex automatically",
    "apply migrations"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:audit-trail-owner-visibility"]);
});

console.log("audit-trail-owner-visibility smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
