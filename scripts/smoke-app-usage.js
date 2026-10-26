// A customer's app gets busy. Before it costs us more than its plan covers, the
// owner must hear about it — once at 80%, once past 100%, never twice for the
// same level in a month, never at all while it's within its plan — and the
// platform owner must see it in the attention queue. Drives the real sweep
// (src/lib/engine/app-usage.ts) against the in-memory stores, email faked at fetch().
process.env.APP_ENGINE_LOCAL_MODE = "true";
for (const key of ["DATABASE_URL", "POSTGRES_URL"]) delete process.env[key];
process.env.NEON_API_KEY = "test-neon";
process.env.AUTH_RESEND_KEY = "re_test";
process.env.EMAIL_FROM = "App Engine <apps@emails.unitedundergod.org>";

const emails = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url === "https://api.resend.com/emails") {
    emails.push(JSON.parse(init.body));
    return reply({ id: `em_${emails.length}` });
  }
  if (/console\.neon\.tech\/api\/v2\/projects\/np_busy$/.test(url)) {
    return reply({ project: { compute_time_seconds: 45 * 3600, data_transfer_bytes: 1024, consumption_period_start: "2026-10-01T00:00:00Z" } });
  }
  throw new Error(`unexpected fetch ${url}`);
};

const { createBuildJob, updateBuildJob } = await import("../src/lib/engine/build-jobs.ts");
const { getNeonProjectUsage } = await import("../src/lib/engine/database-setup.ts");
const { sweepUsage, usageLevel, listAppsNeedingUpgrade, STANDARD_ALLOWANCE } = await import("../src/lib/engine/app-usage.ts");

let failures = 0;
function check(ok, message) {
  if (ok) console.log(`ok - ${message}`);
  else {
    failures += 1;
    console.error(`not ok - ${message}`);
  }
}

// Thresholds.
const quiet = { storageBytes: 10 * 1024 * 1024, computeHours: 2, transferBytes: 0 };
check(usageLevel(quiet).level === "ok", "a quiet app is ok");
check(usageLevel({ ...quiet, computeHours: STANDARD_ALLOWANCE.computeHours * 0.8 }).level === "warn", "80% of compute is a heads-up");
check(usageLevel({ ...quiet, storageBytes: STANDARD_ALLOWANCE.storageBytes }).level === "over", "100% of storage is over");
check(usageLevel({ ...quiet, transferBytes: STANDARD_ALLOWANCE.transferBytes * 3 }).worst.metric === "transfer", "the worst metric is the one reported");

// The Neon usage reader parses what the API returns.
const neonUsage = await getNeonProjectUsage("np_busy");
check(neonUsage?.computeSeconds === 45 * 3600 && neonUsage.periodStart?.startsWith("2026-10"), "Neon project usage is read from the API");

// Sweep: three live apps at different levels, measurement faked per job.
const usageFor = new Map();
async function liveApp(email, measured) {
  const job = await createBuildJob(email, `An app for ${email}`);
  await updateBuildJob(job.id, { status: "live", url: `https://${email.split("@")[0]}.vercel.app`, projectId: `prj_${job.id}` });
  usageFor.set(job.id, measured);
  return job;
}
const calm = await liveApp("calm@example.org", quiet);
const growing = await liveApp("growing@example.org", { ...quiet, computeHours: 42 });
const busy = await liveApp("busy@example.org", { ...quiet, storageBytes: STANDARD_ALLOWANCE.storageBytes * 1.2 });
const measure = async (job) => {
  const m = usageFor.get(job.id);
  return m ? { jobId: job.id, app: job.url, ownerEmail: job.userEmail, ...m, ...usageLevel(m) } : null;
};

const now = new Date("2026-10-20T06:17:00Z");
let result = await sweepUsage(now, measure);
check(result.checked === 3 && result.warned === 1 && result.over === 1, "the sweep checks every live app and flags two");
const to = (addr) => emails.filter((e) => e.to[0] === addr);
check(to("calm@example.org").length === 0, "an app within its plan gets no email");
check(to("growing@example.org").length === 1 && /heads-up/i.test(to("growing@example.org")[0].subject), "an app at 80% gets one heads-up");
check(to("busy@example.org").length === 1 && /bigger plan/i.test(to("busy@example.org")[0].subject), "an app past its plan is asked to upgrade");
check(/nothing is switched off/i.test(to("busy@example.org")[0].text), "the upgrade email promises the app keeps running");
check(!/\bAI\b|generated/i.test(emails.map((e) => e.text).join("\n")), "the emails read like a person wrote them");

// Next day, same levels: no repeats.
await sweepUsage(new Date("2026-10-21T06:17:00Z"), measure);
check(emails.length === 2, "no repeat email for the same level in the same month");

// Growing app crosses 100%: it gets the upgrade email (level rose).
usageFor.set(growing.id, { ...quiet, computeHours: 60 });
await sweepUsage(new Date("2026-10-22T06:17:00Z"), measure);
check(to("growing@example.org").length === 2 && /bigger plan/i.test(to("growing@example.org")[1].subject), "rising from heads-up to over sends the upgrade email");

// The owner sees both in the attention queue.
const flagged = await listAppsNeedingUpgrade("2026-10");
check(flagged.length === 2 && flagged.every((u) => u.level === "over") && !flagged.some((u) => u.jobId === calm.id), "the owner's queue lists the apps that need a bigger plan");

// A new month starts fresh: still over → told again, once.
await sweepUsage(new Date("2026-11-02T06:17:00Z"), measure);
check(to("busy@example.org").length === 2, "a new month re-notifies an app still over its plan");
void busy;

if (failures) {
  console.error(`app-usage smoke failed (${failures})`);
  process.exit(1);
}
console.log("app-usage smoke ok");
