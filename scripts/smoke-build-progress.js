// A customer pays and closes the tab. The build must still finish, they must be
// told once, and a failed paid build must be redone — with nobody's browser open.
// Drives the real sweep (src/lib/engine/build-progress.ts) against the in-memory
// job/order stores, with Vercel and the email provider faked at fetch().
process.env.APP_ENGINE_LOCAL_MODE = "true";
for (const key of ["DATABASE_URL", "POSTGRES_URL", "NEON_API_KEY"]) delete process.env[key];
process.env.VERCEL_TOKEN = "test-token";
process.env.AUTH_RESEND_KEY = "re_test";
process.env.EMAIL_FROM = "App Engine <apps@emails.unitedundergod.org>";

const deployState = new Map();
const emails = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const m = url.match(/\/v13\/deployments\/([^/?]+)/);
  if (m) return reply({ readyState: deployState.get(decodeURIComponent(m[1])) || "BUILDING", url: `${m[1]}.vercel.app` });
  if (url === "https://api.resend.com/emails") {
    emails.push(JSON.parse(init.body));
    return reply({ id: `em_${emails.length}` });
  }
  if (/\.vercel\.app/.test(url)) return new Response("<html>ok</html>", { status: 200 });
  throw new Error(`unexpected fetch ${url}`);
};

const { createBuildJob, getBuildJob, updateBuildJob } = await import("../src/lib/engine/build-jobs.ts");
const { createBuildOrder, markBuildOrderPaid, setBuildOrderSession, getBuildOrder, priceBuildPack } = await import("../src/lib/engine/build-orders.ts");
const { startPaidOrderBuild } = await import("../src/lib/engine/customer-build.ts");
const { sweepBuilds, advanceBuildJob } = await import("../src/lib/engine/build-progress.ts");

let failures = 0;
function check(ok, message) {
  if (ok) console.log(`ok - ${message}`);
  else {
    failures += 1;
    console.error(`not ok - ${message}`);
  }
}

// 1. A deploy nobody is watching finishes → live + one email.
const job = await createBuildJob("buyer@example.org", "A church app for events and giving");
await updateBuildJob(job.id, { status: "deploying", deploymentId: "dpl_a" });
let sweep = await sweepBuilds();
check(sweep.live === 0 && (await getBuildJob(job.id)).status === "deploying", "still building: left alone, no email");
deployState.set("dpl_a", "READY");
sweep = await sweepBuilds();
const done = await getBuildJob(job.id);
check(sweep.live === 1 && done.status === "live" && done.url?.includes("dpl_a"), "the sweep marks the finished deploy live, with no browser open");
check(emails.length === 1 && emails[0].to[0] === "buyer@example.org" && emails[0].text.includes("dpl_a.vercel.app"), "the owner is emailed the live link");
check(!/\bAI\b|generated/i.test(emails[0].text) && emails[0].text.includes("/account"), "the email reads like a person wrote it and points to their apps page");

// 2. A poll racing the sweep never sends a second email.
await advanceBuildJob(done);
await sweepBuilds();
check(emails.length === 1, "no duplicate email when a poll and the sweep both see it");

// 3. A failed deploy is recorded as failed.
const bad = await createBuildJob("buyer@example.org", "Another app");
await updateBuildJob(bad.id, { status: "deploying", deploymentId: "dpl_b" });
deployState.set("dpl_b", "ERROR");
await sweepBuilds();
check((await getBuildJob(bad.id)).status === "failed", "a deploy Vercel failed is marked failed");

// 4. A paid order whose build failed is redone by the sweep (no one checking the order page).
const idea = "Our HOA needs to share announcements and collect dues";
const pack = priceBuildPack(idea, []);
const order = await createBuildOrder("hoa@example.org", { idea }, pack);
await setBuildOrderSession(order.id, "cs_1");
await markBuildOrderPaid({ orderId: order.id, sessionId: "cs_1", amountCents: order.priceCents });
const started = await startPaidOrderBuild(order.id);
await updateBuildJob(started.jobId, { status: "failed", error: "boom" });
sweep = await sweepBuilds();
const after = await getBuildOrder(order.id);
check(sweep.redone === 1 && after.jobId !== started.jobId && after.attempts === 2, "the sweep redoes a failed paid build on its own");
check(after.priceCents === pack.priceCents, "the redo doesn't change what they paid");

if (failures) {
  console.error(`build-progress smoke failed (${failures})`);
  process.exit(1);
}
console.log("build-progress smoke ok");
