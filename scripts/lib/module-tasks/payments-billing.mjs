// Giving: with no Stripe key, a donor is told plainly that online giving isn't
// connected — no checkout, no "thank you, recorded" for a gift that never
// happened, nothing on their statement. A forged Stripe event cannot mark a gift
// paid. When Stripe (simulated: the pending row checkout would have written,
// then correctly signed events) confirms a one-time gift and a monthly gift's
// invoice, both land on the donor's own annual statement and the admin's totals
// — once each, even if Stripe resends the event. The job is "a gift given is a
// gift recorded, and only then".
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { api, expectText } from "./_helpers.mjs";

// The webhook must verify Stripe's signature, so the app under test needs a
// signing secret. Set before the harness starts any app server (servers inherit
// this process's env). No STRIPE_SECRET_KEY is set: nothing here reaches Stripe.
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_prove_only_signing_secret_0123456789";

function signed(payload) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

async function webhook(page, base, event, signature) {
  const payload = JSON.stringify(event);
  const headers = { "content-type": "application/json" };
  if (signature !== null) headers["stripe-signature"] = signature ?? signed(payload);
  const res = await page.request.post(`${base}/api/giving/webhook`, { data: payload, headers });
  return res.status();
}

// The running app's database: of the databases carrying this run's prefix, the
// one where this run's donor signed up. Used only to stand in for the row a real
// Stripe checkout would have created.
async function appDbWith(probe, params) {
  const pg = createRequire(import.meta.url)("pg");
  const admin = new pg.Client({ connectionString: process.env.PROVE_PG_URL });
  await admin.connect();
  const prefix = (process.env.PROVE_DB_PREFIX || "prove_").replace(/_/g, "\\_");
  const { rows } = await admin.query("select datname from pg_database where datname like $1 order by oid desc", [`${prefix}%`]);
  await admin.end();
  for (const { datname } of rows) {
    const url = new URL(process.env.PROVE_PG_URL);
    url.pathname = `/${datname}`;
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    const found = await client.query(probe, params).then((r) => r.rows.length > 0, () => false);
    if (found) return client;
    await client.end();
  }
  throw new Error("could not find the app's database");
}

// A donor with an address unique to this run (so the database can be found).
async function signUpDonor(page, base) {
  const ctx = await page.context().browser().newContext();
  const donor = await ctx.newPage();
  const email = `donor-${crypto.randomBytes(4).toString("hex")}@example.com`;
  await donor.goto(`${base}/sign-in`);
  await donor.fill('input[name="email"]', email);
  await donor.fill('input[name="password"]', "prove-password-123");
  await Promise.all([donor.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20000 }), donor.click('button[value="register"]')]);
  return Object.assign(donor, { email, close: () => ctx.close() });
}

export async function task({ page, base, newMember }) {
  const donor = await signUpDonor(page, base);
  try {
    // 1. No Stripe key: the giving page says so up front, and can't start a checkout.
    await donor.goto(`${base}/giving`, { waitUntil: "domcontentloaded" });
    const givingText = await donor.locator("body").innerText();
    if (!/not connected yet/i.test(givingText)) throw new Error("the giving page does not tell the donor online giving isn't connected");
    const res = await donor.request.post(`${base}/api/giving/checkout`, { data: { amountCents: 2500, fundName: "General Fund", frequency: "one-time" } });
    const body = await res.json().catch(() => ({}));
    if (res.ok() || body.ok || body.url) throw new Error(`checkout "succeeded" with no payment provider (${res.status()})`);
    if (!/not connected/i.test(body.message || "")) throw new Error(`checkout refusal is unclear: "${body.message}"`);
    const none = await api(donor, "GET", `${base}/api/giving/gifts`);
    if ((none.gifts || []).length) throw new Error("a refused checkout still recorded a gift");

    // 2. Landing on the success URL without a confirmed gift claims nothing.
    await donor.goto(`${base}/giving?status=success`, { waitUntil: "domcontentloaded" });
    if (/recorded successfully/i.test(await donor.locator("body").innerText())) throw new Error("/giving?status=success claims a gift was recorded when none was");

    // 3. Stand in for checkout: the pending rows Stripe's session would have created.
    const db = await appDbWith("select 1 from users where email = $1", [donor.email]);
    try {
      await db.query(
        "insert into payments_billing_gifts (donor_name, donor_email, fund_name, amount_cents, frequency, stripe_session_id) values ('Dana Donor', $1, 'Missions', 2500, 'one-time', 'cs_prove_one')",
        [donor.email]
      );
      await db.query(
        "insert into payments_billing_recurring_gifts (donor_name, donor_email, fund_name, amount_cents, stripe_session_id) values ('Dana Donor', $1, 'General Fund', 1000, 'cs_prove_monthly')",
        [donor.email]
      );
    } finally {
      await db.end();
    }

    // 4. A forged event (no signature, or a wrong one) settles nothing.
    const completedOne = { id: "evt_prove_1", type: "checkout.session.completed", data: { object: { id: "cs_prove_one", mode: "payment", payment_status: "paid", amount_total: 2500 } } };
    if ((await webhook(donor, base, completedOne, null)) < 400) throw new Error("an unsigned webhook event was accepted");
    if ((await webhook(donor, base, completedOne, `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`)) < 400) throw new Error("a webhook event with a bad signature was accepted");
    const stillPending = await api(donor, "GET", `${base}/api/giving/gifts`);
    if ((stillPending.gifts || []).some((g) => g.status === "paid")) throw new Error("a forged webhook marked a gift paid");
    if (Number(stillPending.stats?.totalCents) !== 0) throw new Error("a pending gift counts toward the donor's total");

    // 5. Stripe confirms the one-time gift → on the donor's statement.
    if ((await webhook(donor, base, completedOne)) !== 200) throw new Error("a correctly signed checkout.session.completed was refused");
    await expectText(donor, `${base}/giving/statement`, "Missions", "the paid gift's fund is on the donor's statement");
    await expectText(donor, `${base}/giving/statement`, "$25.00", "the paid gift's amount is on the donor's statement");

    // 6. The monthly gift: subscription starts, then each paid invoice is a gift.
    const sub = { id: "evt_prove_2", type: "checkout.session.completed", data: { object: { id: "cs_prove_monthly", mode: "subscription", subscription: "sub_prove_1", customer_email: donor.email } } };
    if ((await webhook(donor, base, sub)) !== 200) throw new Error("a signed subscription checkout was refused");
    await expectText(donor, `${base}/giving`, "$10.00 monthly", "the donor sees their monthly gift");
    const invoice = { id: "evt_prove_3", type: "invoice.paid", data: { object: { id: "in_prove_1", subscription: "sub_prove_1", amount_paid: 1000, customer_email: donor.email } } };
    if ((await webhook(donor, base, invoice)) !== 200) throw new Error("a signed invoice.paid was refused");
    if ((await webhook(donor, base, invoice)) !== 200) throw new Error("a resent invoice.paid was refused");
    const stats = (await api(donor, "GET", `${base}/api/giving/gifts`)).stats;
    if (Number(stats?.totalCents) !== 3500 || Number(stats?.giftCount) !== 2) {
      throw new Error(`donor's year shows ${stats?.giftCount} gifts / ${stats?.totalCents}¢ — expected the $25 gift and one $10 monthly payment (2 / 3500¢)`);
    }
    await expectText(donor, `${base}/giving/statement`, "$35.00", "the monthly payment is on the donor's annual statement");

    // 7. The admin sees the totals; another member sees none of it.
    await expectText(page, `${base}/admin/giving`, "$35.00", "the admin's giving total includes both gifts");
    const other = await newMember();
    const theirs = await api(other, "GET", `${base}/api/giving/gifts`);
    if ((theirs.gifts || []).length || Number(theirs.stats?.totalCents)) throw new Error("another member can see the donor's gifts");
    if ((await other.request.get(`${base}/admin/giving`, { maxRedirects: 0 })).status() === 200) {
      const text = await (await other.request.get(`${base}/admin/giving`)).text();
      if (text.includes("Dana Donor")) throw new Error("a member can open the admin giving page");
    }
  } finally {
    await donor.close();
  }
}
