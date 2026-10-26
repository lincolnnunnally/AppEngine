import fs from "node:fs";

// C3: pay the quoted pack price once, build exactly that pack. Exercises the
// order lifecycle the checkout route and Stripe webhook drive (local/in-memory
// store), plus the route wiring that keeps money and builds tied together.
process.env.APP_ENGINE_LOCAL_MODE = "true";
for (const key of ["DATABASE_URL", "POSTGRES_URL", "NEON_API_KEY", "STRIPE_SECRET_KEY", "APP_ENGINE_FLAT_CHECKOUT_ENABLED"]) delete process.env[key];

const {
  claimPaidOrderForBuild,
  createBuildOrder,
  flatCheckoutEnabled,
  flatCheckoutReadiness,
  getBuildOrder,
  markBuildOrderPaid,
  priceBuildPack,
  setBuildOrderSession
} = await import("../src/lib/engine/build-orders.ts");
const { rebuildPaidOrder, startPaidOrderBuild } = await import("../src/lib/engine/customer-build.ts");
const { getBuildJob, updateBuildJob } = await import("../src/lib/engine/build-jobs.ts");
const { listOrdersNeedingRebuild, MAX_AUTOMATIC_BUILD_ATTEMPTS } = await import("../src/lib/engine/build-orders.ts");
const { estimateBuild } = await import("../src/lib/engine/pricing/estimate.ts");

let failures = 0;
function check(ok, message) {
  if (ok) console.log(`ok - ${message}`);
  else {
    failures += 1;
    console.error(`not ok - ${message}`);
  }
}

// Off by default: no flag, no Stripe, no engine database.
check(!flatCheckoutEnabled(), "checkout is off unless the flag, Stripe and the database are all configured");
check(!flatCheckoutReadiness().ok, "readiness reports not-ready while off");

// Money gate: on, but customer apps can't get a database → refuse to sell.
process.env.APP_ENGINE_FLAT_CHECKOUT_ENABLED = "true";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_for_smoke_only_000000";
process.env.DATABASE_URL = "postgresql://user:pw@db.example.com/engine";
check(flatCheckoutEnabled(), "flag + Stripe + database = checkout on");
const noDb = flatCheckoutReadiness();
check(!noDb.ok && /can't take payments/.test(noDb.message || ""), "with no database service for customer apps, checkout refuses to take money");
process.env.NEON_API_KEY = "test-neon-key";
check(flatCheckoutReadiness().ok, "with a Neon key, checkout is ready");
for (const key of ["DATABASE_URL", "NEON_API_KEY", "STRIPE_SECRET_KEY", "APP_ENGINE_FLAT_CHECKOUT_ENABLED"]) delete process.env[key];

// Price comes from the server's estimator, from the ticked features only.
const idea = "I run a small church and need people to sign up for events and give online";
const quoted = estimateBuild({ needText: idea });
const featureIds = quoted.features.filter((f) => f.selected).map((f) => f.id);
const pack = priceBuildPack(idea, featureIds);
check(!("error" in pack) && pack.priceCents === quoted.priceCents, `order price matches the quote the customer saw (${quoted.priceLabel})`);
check(!("error" in pack) && [...pack.moduleSlugs].sort().join() === [...quoted.moduleSlugs].sort().join(), "order modules match the quoted pack");
const cheaper = priceBuildPack(idea, ["scheduling"]);
check(!("error" in cheaper) && cheaper.priceCents === 3500 && !cheaper.moduleSlugs.includes("payments-billing"), "fewer features = lower price and fewer modules ($35: core + events)");

const order = await createBuildOrder("buyer@example.com", { idea }, pack);
await setBuildOrderSession(order.id, "cs_test_1");
check(order.status === "pending" && order.priceCents === pack.priceCents, "a new order is pending at the server price");

// Webhook: Stripe's amount must equal the order price; the session must match.
const wrongAmount = await markBuildOrderPaid({ orderId: order.id, sessionId: "cs_test_1", amountCents: order.priceCents - 100 });
check(!wrongAmount.ok && wrongAmount.reason === "amount_mismatch", "a payment for a different amount is refused");
const wrongSession = await markBuildOrderPaid({ orderId: order.id, sessionId: "cs_other", amountCents: order.priceCents });
check(!wrongSession.ok && wrongSession.reason === "session_mismatch", "a payment from another checkout session is refused");
check((await getBuildOrder(order.id)).status === "pending", "refused payments leave the order unpaid");
const missing = await markBuildOrderPaid({ orderId: "ord_nope", sessionId: "cs_test_1", amountCents: 100 });
check(!missing.ok && missing.reason === "not_found", "an unknown order is refused");

const paid = await markBuildOrderPaid({ orderId: order.id, sessionId: "cs_test_1", amountCents: order.priceCents, paymentIntent: "pi_1" });
check(paid.ok && paid.firstTime && paid.order.status === "paid", "the matching payment marks the order paid");
const retry = await markBuildOrderPaid({ orderId: order.id, sessionId: "cs_test_1", amountCents: order.priceCents });
check(retry.ok && !retry.firstTime, "a retried webhook is recognised, not re-applied");

// One paid order, one build.
const first = await startPaidOrderBuild(order.id);
check(Boolean(first?.jobId && first.run), "the paid order starts a build");
const job = await getBuildJob(first.jobId);
check(job && job.userEmail === "buyer@example.com" && job.idea === idea, "the build job belongs to the buyer and their idea");
const again = await startPaidOrderBuild(order.id);
check(again?.jobId === first.jobId && !again.run, "a second start (webhook retry) returns the same job and builds nothing new");
check((await getBuildOrder(order.id)).status === "building", "the order is now building");
check((await claimPaidOrderForBuild(order.id, "job_other")) === null, "a building order can't be claimed again");

// C7 — owner policy: a failed paid build is redone; the customer is never charged again.
check((await rebuildPaidOrder(order.id))?.jobId === first.jobId, "a build that hasn't failed is not redone");
await updateBuildJob(first.jobId, { status: "failed", error: "deploy hiccup" });
const redo = await rebuildPaidOrder(order.id);
check(Boolean(redo?.jobId && redo.jobId !== first.jobId && redo.run), "a failed paid build is redone automatically with a fresh job");
check((await getBuildOrder(order.id)).attempts === 2 && (await getBuildOrder(order.id)).status === "building", `the order records attempt 2 of ${MAX_AUTOMATIC_BUILD_ATTEMPTS}`);
const racer = await rebuildPaidOrder(order.id);
check(racer?.jobId === redo.jobId && !racer.run, "a second poller follows the redo instead of starting another");
await updateBuildJob(redo.jobId, { status: "failed", error: "same bug again" });
const exhausted = await rebuildPaidOrder(order.id);
check(exhausted && "exhausted" in exhausted, "after the automatic attempts, it stops redoing on its own");
const waiting = await getBuildOrder(order.id);
check(waiting.status === "build_failed" && waiting.lastError === "same bug again", "the order waits on the owner with the reason");
check((await listOrdersNeedingRebuild()).some((o) => o.id === order.id), "the order is in the owner's attention list");
const byOwner = await rebuildPaidOrder(order.id, { byOwner: true });
check(Boolean(byOwner?.jobId && byOwner.run) && (await getBuildOrder(order.id)).status === "building", "the owner can always rebuild it");
check((await getBuildOrder(order.id)).priceCents === pack.priceCents, "no redo changes what the customer paid");

const unpaid = await createBuildOrder("buyer@example.com", { idea }, pack);
check((await startPaidOrderBuild(unpaid.id)) === null, "an unpaid order never starts a build");

// Route wiring that ties money to builds.
const read = (p) => fs.readFileSync(p, "utf8");
const start = read("src/app/api/build/start/route.ts");
check(/flatCheckoutEnabled\(\) && !\(await canAccessEngineAdmin\(\)\)/.test(start) && start.includes("402"), "with checkout on, /api/build/start refuses unpaid customer builds (owner exempt)");
const checkoutRoute = read("src/app/api/build/checkout/route.ts");
check(checkoutRoute.includes("priceBuildPack(idea, featureIds)") && !/body\.(priceCents|moduleSlugs)/.test(checkoutRoute), "checkout prices on the server and ignores any client price or module list");
check(checkoutRoute.includes("flatCheckoutReadiness()"), "checkout applies the money gate before creating an order");
const webhook = read("src/app/api/billing/webhook/route.ts");
check(webhook.includes('metadata.stream === "build-order"') && webhook.includes("markBuildOrderPaid") && webhook.includes("startPaidOrderBuild"), "the signed webhook marks the order paid and starts its build");
check(webhook.indexOf("verifyStripeSignature") < webhook.indexOf('"build-order"'), "the signature is checked before any order is touched");
// Sent by ChurchConnect or Operate: same price, and the order remembers who sent it.
const { parseArrival } = await import("../src/lib/ui/arrival.ts");
const sent = parseArrival({ from: "ChurchConnect", org: "  Grace <b>Chapel</b>  " });
check(sent?.from === "churchconnect" && sent.org === "Grace bChapel/b", "an arrival from ChurchConnect is recognised and its church name cleaned");
check(parseArrival({ from: "elsewhere", org: "x" }) === null && parseArrival(null) === null, "an unknown source is ignored");
const fromChurch = await createBuildOrder("pastor@example.org", { idea, arrival: sent }, pack);
check(
  fromChurch.source === "churchconnect" && fromChurch.organization === "Grace bChapel/b" && fromChurch.priceCents === pack.priceCents,
  "an order from ChurchConnect records its source and church, at the same price"
);
check((await createBuildOrder("walkin@example.org", { idea }, pack)).source === null, "a direct order has no source");
check(read("src/app/api/build/checkout/route.ts").includes("parseArrival(body.arrival"), "checkout re-validates the arrival on the server");

const customerBuild = read("src/lib/engine/customer-build.ts");
check(customerBuild.includes("options.prepaid ? undefined : userKey"), "a paid order's build is never metered a second time");

if (failures) {
  console.error(`flat-checkout smoke failed (${failures})`);
  process.exit(1);
}
console.log("flat-checkout smoke ok");
