import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { verifyStripeSignature } from "../src/lib/engine/stripe.ts";

// Billing smoke. Runtime-tests the money-critical Stripe webhook signature check;
// structurally verifies the credit model is idempotent + dormant-by-default and
// the routes are gated. Run: node scripts/smoke-billing.js
const repoRoot = process.cwd();

runStep("stripe webhook signature verification is correct and fail-closed", () => {
  const secret = "whsec_test_secret";
  const body = '{"id":"evt_1","type":"checkout.session.completed"}';
  const t = 1700000000;
  const good = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const header = `t=${t},v1=${good}`;

  assertEqual(verifyStripeSignature(body, header, secret, 300, t), true, "valid signature passes");
  assertEqual(verifyStripeSignature(body + "tamper", header, secret, 300, t), false, "tampered body rejected");
  assertEqual(verifyStripeSignature(body, header, "whsec_other", 300, t), false, "wrong secret rejected");
  assertEqual(verifyStripeSignature(body, header, secret, 300, t + 1000), false, "stale timestamp rejected");
  assertEqual(verifyStripeSignature(body, null, secret, 300, t), false, "missing header rejected");
  assertEqual(verifyStripeSignature(body, header, undefined, 300, t), false, "missing secret rejected");
});

runStep("credit model is money-safe: integer cents + idempotent ledger", () => {
  const text = read("src/lib/engine/billing.ts");
  assertIncludes(text, "balance_cents bigint", "balance stored as integer cents");
  assertIncludes(text, "ON CONFLICT (reference) DO NOTHING", "ledger reference is idempotent");
  assertIncludes(text, "reference text UNIQUE", "ledger reference is unique");
  assertIncludes(text, "build:${buildReference}", "build charges idempotent per build");
  assertIncludes(text, "free_starter:", "free starter granted once per user");
});

runStep("billing is dormant until explicitly enabled + fully configured", () => {
  const text = read("src/lib/engine/billing.ts");
  assertIncludes(text, 'process.env.APP_ENGINE_BILLING_ENABLED === "true"', "needs explicit flag");
  // isBillingEnabled requires flag AND db AND stripe
  const idx = text.indexOf("export function isBillingEnabled");
  const block = text.slice(idx, idx + 240);
  assertIncludes(block, "getConfiguredDatabaseUrl()", "requires a database");
  assertIncludes(block, "hasStripe()", "requires Stripe configured");
});

runStep("checkout route is customer-gated and validates the pack", () => {
  const text = read("src/app/api/billing/checkout/route.ts");
  assertIncludes(text, "canAccessEngineConsumerSurface", "requires sign-in");
  assertIncludes(text, "isBillingEnabled", "off unless billing enabled");
  assertIncludes(text, "packsCents.includes", "only valid packs");
});

runStep("webhook verifies signature, is idempotent, and is not auth-gated", () => {
  const text = read("src/app/api/billing/webhook/route.ts");
  assertIncludes(text, "verifyStripeSignature", "checks the signature");
  assertIncludes(text, "stripe_evt:${event.id}", "idempotent per event id");
  if (text.includes("canAccessEngine")) throw new Error("webhook must NOT be auth-gated (Stripe is the caller)");
});

runStep("Stripe credentials are enterable from the owner Integrations dashboard", () => {
  const text = read("src/lib/engine/integrations-config.ts");
  assertIncludes(text, "STRIPE_SECRET_KEY", "stripe secret field");
  assertIncludes(text, "STRIPE_WEBHOOK_SECRET", "stripe webhook field");
});

console.log("billing smoke ok");

function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), "utf8");
}
function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) throw new Error(`${label}: expected to contain "${phrase}"`);
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
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
