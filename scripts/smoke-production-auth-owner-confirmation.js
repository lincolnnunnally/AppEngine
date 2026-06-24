import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("owner confirmation artifact builds on auth readiness", () => {
  assertFileIncludes("src/lib/engine/production-auth-owner-confirmation.ts", [
    "production_auth_owner_confirmation",
    "createProductionAuthReadinessReport",
    "blocked_pending_owner_confirmation",
    "confirmed_for_controlled_use",
    "ownerOnlyApis"
  ]);
});

runStep("confirmation requires protected routes and admin APIs", () => {
  assertFileIncludes("src/lib/engine/production-auth-owner-confirmation.ts", [
    "protectedRoutes",
    "adminOnlyApis",
    "confirmedProtectedRoutesReviewed",
    "confirmedAdminApisReviewed"
  ]);
});

runStep("confirmation lists env names without exposing values", () => {
  assertFileIncludes("src/lib/engine/production-auth-owner-confirmation.ts", [
    "requiredEnvVarNames",
    "AUTH_SECRET",
    "APP_ENGINE_OWNER_EMAIL",
    "noSecretValuesReadOrExposed: true"
  ]);
});

runStep("confirmation fails honestly when incomplete", () => {
  assertFileIncludes("src/lib/engine/production-auth-owner-confirmation.ts", [
    "missingOwnerConfirmations",
    "Owner notes are required before controlled production use",
    "Do not use controlled production until each confirmation is recorded"
  ]);
});

runStep("source of truth documents owner confirmation", () => {
  assertFileIncludes("source-of-truth/production-auth-owner-confirmation.md", [
    "Production Auth Owner Confirmation",
    "production_auth_owner_confirmation",
    "must fail honestly",
    "Required Protected APIs",
    "/opportunity-intake",
    "/problem-intake-lite",
    "/owner-control-center",
    "/api/opportunity-intake",
    "/api/problem-intake-lite",
    "/api/engine/health"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:production-auth-owner-confirmation"]);
});

console.log("production-auth-owner-confirmation smoke ok");

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
