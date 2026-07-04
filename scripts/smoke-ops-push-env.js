// Smoke: push-to-Vercel — the owner can push a value saved in their key vault
// straight into an app's Vercel project, so they don't paste it by hand. Guards
// the safety rails (owner-only, registry-defined slots only, value from the
// vault) and the wiring, the same string-presence way as the other smokes.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("the push action is narrow and safe by construction", () => {
  assertFileIncludes("src/lib/engine/ops-push-env.ts", [
    "pushVaultValueToVercel",
    "isPushableCredential",
    "CREDENTIAL_REGISTRY",
    "resolveEnvForApp",
    'key.host === "vercel"',
    "group.vercelProjectId",
    'type: "encrypted"',
    "Add ${envVar} to your key vault first"
  ]);
});

runStep("the push route is owner-gated with no local bypass", () => {
  assertFileIncludes("src/app/api/engine/ops/push-env/route.ts", [
    "canAccessEngineOwner",
    "normalizeUserKey",
    "pushVaultValueToVercel",
    "Unauthorized"
  ]);
  refuteFileIncludes("src/app/api/engine/ops/push-env/route.ts", ["isLocalMode"]);
});

runStep("the credentials page offers the push only on pushable Vercel keys", () => {
  assertFileIncludes("src/app/(cockpit)/credentials/page.tsx", [
    "CredentialPushButton",
    "isPushableCredential(group.slug, key.envVar)",
    'key.whoProvides === "lincoln"'
  ]);
  assertFileIncludes("src/components/engine/credential-push-button.tsx", [
    "/api/engine/ops/push-env",
    "window.confirm",
    "Push my saved value"
  ]);
  assertFileIncludes("src/app/styles.css", [".cred-push-note"]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:ops-push-env\""]);
});

console.log("ops-push-env smoke ok");

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = readFile(relativePath);
  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function refuteFileIncludes(relativePath, forbiddenValues) {
  const content = readFile(relativePath);
  for (const forbidden of forbiddenValues) {
    if (content.includes(forbidden)) {
      throw new Error(`${relativePath} must NOT include ${JSON.stringify(forbidden)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
