// CRM & follow-up: the church's admin adds a guest to the pipeline, moves them
// through stages, and logs a follow-up — and each step lands on the lead's page
// and in its activity timeline, attributed to the signed-in admin (users.id, not
// an email). A member must not be able to read or change the pipeline (it holds
// guests' names, emails and phone numbers). The job is "no one falls through
// the cracks".
import { createRequire } from "node:module";
import { api, expectText } from "./_helpers.mjs";

async function expectRefused(page, method, url, body, what) {
  const res = await page.request.fetch(url, {
    method,
    data: body === undefined ? undefined : body,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    maxRedirects: 0
  });
  if (res.status() < 400) throw new Error(`${what}: expected a refusal, got ${res.status()} ${(await res.text()).slice(0, 120)}`);
}

// The running app's database: of the databases carrying this run's prefix, the
// one holding this lead (robust when several apps run at once). Used only to
// read what the app wrote that no page shows, like who logged an activity.
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

export async function task({ page, base, newMember }) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // 1. Admin adds a first-time guest, already due for a call.
  const created = await api(page, "POST", `${base}/api/crm`, {
    name: "Prove Family",
    contactName: "Pat Prove",
    email: "pat.prove@example.com",
    phone: "555-0100",
    city: "Springfield",
    priority: "high",
    source: "walk_in",
    nextAction: "Call to say welcome",
    nextActionDate: yesterday
  });
  const id = created.lead?.id;
  if (!id) throw new Error("adding a lead returned no id");
  if (created.lead.stage !== "new") throw new Error(`a new lead starts in "${created.lead.stage}", not "new"`);
  await expectText(page, `${base}/crm`, "Prove Family", "the admin sees the guest in the pipeline");
  await expectText(page, `${base}/crm`, "Overdue follow-ups", "an overdue next action is flagged on the pipeline");

  // 2. Move them through the pipeline.
  await api(page, "POST", `${base}/api/crm/${id}`, { stage: "contacted" });
  await api(page, "POST", `${base}/api/crm/${id}`, { stage: "interested" });

  // 3. Log the follow-up call and set the next step.
  await api(page, "POST", `${base}/api/crm/${id}`, {
    type: "call",
    description: "Talked about the Sunday service times",
    nextAction: "Invite to newcomers lunch",
    nextActionDate: nextWeek
  });

  const detail = await api(page, "GET", `${base}/api/crm/${id}`);
  if (detail.lead?.stage !== "interested") throw new Error(`lead is in "${detail.lead?.stage}" after moving it to interested`);
  if (Number(detail.lead?.followupCount) !== 1) throw new Error(`follow-up count is ${detail.lead?.followupCount}, expected 1`);
  if (!detail.lead?.lastContact) throw new Error("logging a call did not record the last contact");
  if (detail.lead?.nextAction !== "Invite to newcomers lunch") throw new Error(`next action is "${detail.lead?.nextAction}"`);
  const types = (detail.activities || []).map((a) => a.type).sort().join(",");
  if (types !== "call,created,status_change,status_change") throw new Error(`timeline holds [${types}]`);
  await expectText(page, `${base}/crm/${id}`, "Talked about the Sunday service times", "the logged call is on the lead's timeline");
  await expectText(page, `${base}/crm/${id}`, "Stage changed from “Contacted” to “Interested”", "the stage move is on the timeline");
  await expectText(page, `${base}/crm/${id}`, "Invite to newcomers lunch", "the next action shows on the lead");

  // 4. Every activity is attributed to the admin who did it (users.id).
  const db = await appDbWith("select 1 from crm_leads where id = $1", [id]);
  try {
    const { rows } = await db.query(
      "select count(*)::int as n, count(*) filter (where a.created_by = u.id)::int as mine from crm_lead_activities a, users u where a.lead_id = $1 and u.email = 'owner@example.com'",
      [id]
    );
    if (rows[0].n !== 4 || rows[0].mine !== 4) throw new Error(`${rows[0].mine}/${rows[0].n} activities are attributed to the admin who logged them`);
  } finally {
    await db.end();
  }

  // 5. A member cannot read or change the pipeline.
  const member = await newMember();
  await expectRefused(member, "GET", `${base}/api/crm`, undefined, "a member lists the pipeline");
  await expectRefused(member, "GET", `${base}/api/crm/${id}`, undefined, "a member reads a guest's record");
  await expectRefused(member, "POST", `${base}/api/crm/${id}`, { stage: "lost" }, "a member moves a lead");
  await member.goto(`${base}/crm`, { waitUntil: "domcontentloaded" });
  if ((await member.locator("body").innerText()).includes("Prove Family")) throw new Error("a member can see guests in the pipeline page");
  await member.goto(`${base}/crm/${id}`, { waitUntil: "domcontentloaded" });
  if ((await member.locator("body").innerText()).includes("pat.prove@example.com")) throw new Error("a member can open a guest's contact details");
}
