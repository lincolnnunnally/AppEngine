// Smoke: the key vault gives the owner a place to add EVERY key his apps need —
// including Supabase and Anthropic — and clearly separates universal (set once)
// from per-app values. Guards the catalog + the UI framing the same way the
// other smokes do (string presence, no runtime).
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("the vault catalog covers the keys Lincoln's apps actually need", () => {
  assertFileIncludes("src/lib/engine/env-vault.ts", [
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "RENDER_API_KEY",
    'scope: "universal"',
    'scope: "per_app"'
  ]);
});

runStep("the vault UI separates universal from per-app and reaches the credentials map", () => {
  assertFileIncludes("src/components/account/env-vault.tsx", [
    "Universal — set once, used by every app",
    "Per-app — usually different for each app",
    "Something else — type any key name",
    "Where this key applies",
    "Every app (universal — set once)",
    "/credentials"
  ]);
  assertFileIncludes("src/app/styles.css", [".env-vault-scope-choose", ".env-vault-saved-heading"]);
});

runStep("custom keys of any name are still allowed (guidance, not a whitelist)", () => {
  assertFileIncludes("src/lib/engine/env-vault.ts", ["KEY_PATTERN", "isValidVaultKey"]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:env-vault\""]);
});

console.log("env-vault smoke ok");

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

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
