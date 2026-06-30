import fs from "node:fs";
import path from "node:path";

// Structural smoke for the Spaceship domain-buy flow. Focus: it never buys without
// confirmation, it's dormant until configured, and money ordering is correct
// (charge -> register -> refund on failure). Run: node scripts/smoke-domain-purchase.js
const repoRoot = process.cwd();

runStep("purchase is confirm-required and dormant until configured", () => {
  const text = read("src/lib/engine/domain-purchase.ts");
  assertIncludes(text, "if (!confirm)", "requires explicit confirmation");
  assertIncludes(text, "domainPurchaseEnabled()", "off unless Spaceship + billing configured");
  assertIncludes(text, "isBillingEnabled()", "needs billing");
  assertIncludes(text, "SPACESHIP_CONTACT_ID", "needs a registrant contact");
});

runStep("money ordering is correct: charge -> register -> refund on failure", () => {
  const text = read("src/lib/engine/domain-purchase.ts");
  const chargeAt = text.indexOf("chargeForDomain(");
  const registerAt = text.indexOf("/domains/${encodeURIComponent(quote.domain)}`, {");
  const refundAt = text.indexOf("creditAccount(");
  if (!(chargeAt > -1 && registerAt > chargeAt && refundAt > registerAt)) {
    throw new Error("expected charge -> register -> refund ordering");
  }
  assertIncludes(text, "refund:domain:", "refund is idempotent per domain");
  assertIncludes(text, "balance < quote.chargeCents", "checks affordability before charging");
});

runStep("buy route is sign-in gated and two-step (quote then confirm)", () => {
  const text = read("src/app/api/domains/buy/route.ts");
  assertIncludes(text, "canAccessEngineConsumerSurface", "sign-in gated");
  assertIncludes(text, "needsConfirm: true", "returns a quote to confirm first");
  assertIncludes(text, "purchaseDomainForCustomer(userKey, domain, projectName, true)", "purchases only on confirm");
});

runStep("Spaceship credentials are enterable from Integrations", () => {
  const text = read("src/lib/engine/integrations-config.ts");
  for (const k of ["SPACESHIP_API_KEY", "SPACESHIP_API_SECRET", "SPACESHIP_CONTACT_ID"]) {
    assertIncludes(text, k, `${k} field`);
  }
});

console.log("domain-purchase smoke ok");

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
