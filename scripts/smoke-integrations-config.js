import fs from "node:fs";
import path from "node:path";

// Structural smoke for the owner Integrations dashboard. Focus: the security
// model (owner-gated page + server actions re-check owner; allowlist-only writes;
// secrets never returned to the client). Run: node scripts/smoke-integrations-config.js
const repoRoot = process.cwd();

runStep("config writes only an allowlist, never returns secret values", () => {
  const text = read("src/lib/engine/integrations-config.ts");
  assertIncludes(text, "INTEGRATION_FIELDS", "field allowlist");
  assertIncludes(text, "isAllowedKey", "allowlist check");
  assertIncludes(text, "SERVER ONLY", "marked server-only");
  // status is presence-only — must not return env values
  assertIncludes(text, "Record<string, boolean>", "status is boolean presence, not values");
  // secrets stored encrypted on the host
  assertIncludes(text, '"encrypted"', "secret fields stored encrypted");
  // the setter rejects unknown keys
  assertIncludes(text, "isn't editable here", "rejects keys outside the allowlist");
});

runStep("page is owner-gated and server actions re-check owner", () => {
  const text = read("src/app/(cockpit)/integrations/page.tsx");
  // page guard
  assertIncludes(text, "canAccessEngineOwner", "owner gate import/use");
  // both server actions
  const saveIdx = text.indexOf("async function saveAction");
  const applyIdx = text.indexOf("async function applyAction");
  if (saveIdx < 0 || applyIdx < 0) throw new Error("expected saveAction and applyAction server actions");
  const saveBlock = text.slice(saveIdx, applyIdx);
  const applyBlock = text.slice(applyIdx, text.indexOf("export default"));
  for (const [name, block] of [["saveAction", saveBlock], ["applyAction", applyBlock]]) {
    assertIncludes(block, '"use server"', `${name} is a server action`);
    assertIncludes(block, "canAccessEngineOwner", `${name} re-checks owner access`);
  }
});

runStep("integrations reachable from the operator rail", () => {
  assertIncludes(read("src/components/engine/app-shell.tsx"), '"/integrations"', "rail links integrations");
});

console.log("integrations-config smoke ok");

function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), "utf8");
}
function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) throw new Error(`${label}: expected to contain "${phrase}"`);
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
