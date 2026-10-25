// Admin ops: a member reports someone, the admin works the report and suspends
// the target — who can then no longer sign in — and an admin grant really makes
// the other member an admin on their next sign-in. Every action is audited, and
// members can't read the console's member list.
import { api, expectText } from "./_helpers.mjs";

const PASSWORD = "prove-password-123";

async function signInFresh(browser, base, email) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${base}/sign-in`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[value="signin"]');
  await p.waitForURL((url) => !url.pathname.startsWith("/sign-in") || url.searchParams.has("error"), { timeout: 20000 }).catch(() => {});
  const ok = !new URL(p.url()).pathname.startsWith("/sign-in");
  return { ctx, page: p, ok };
}

export async function task({ page, base, newMember }) {
  const browser = page.context().browser();
  const target = await newMember();
  const reporter = await newMember();

  // Members can't read every account in the app.
  const peek = await reporter.request.get(`${base}/api/admin-ops/users`);
  if (peek.status() < 400) throw new Error(`a member reading the user list got ${peek.status()}`);

  const { users } = await api(page, "GET", `${base}/api/admin-ops/users?q=${encodeURIComponent(target.email)}`);
  const targetRow = users?.find((u) => u.email === target.email);
  if (!targetRow) throw new Error("admin cannot find the member in the user list");
  const reporterRow = (await api(page, "GET", `${base}/api/admin-ops/users?q=${encodeURIComponent(reporter.email)}`)).users?.find((u) => u.email === reporter.email);

  // Self-guardrail.
  const session = await (await page.request.get(`${base}/api/auth/session`)).json();
  const selfSuspend = await page.request.post(`${base}/api/admin-ops/users`, { data: { targetId: session.user.id, action: "suspend" } });
  if (selfSuspend.status() !== 400) throw new Error(`admin suspending themselves got ${selfSuspend.status()}, expected 400`);

  // A member files a report; the admin sees it and suspends the target.
  await api(reporter, "POST", `${base}/api/admin-ops/reports/new`, { reportedEmail: target.email, reason: "Spam messages", note: "Sent me ads three times." });
  const { reports } = await api(page, "GET", `${base}/api/admin-ops/reports?status=open`);
  const report = reports?.find((r) => r.reportedEmail === target.email && r.reason === "Spam messages");
  if (!report) throw new Error("the admin does not see the member's report");
  await api(page, "POST", `${base}/api/admin-ops/reports`, { reportId: report.id, action: "suspend_target", note: "Confirmed spam." });

  const suspended = (await api(page, "GET", `${base}/api/admin-ops/users?status=suspended`)).users?.find((u) => u.id === targetRow.id);
  if (!suspended) throw new Error("the target is not listed as suspended");
  // Their session that was already open ends too — not only new sign-ins.
  const openSession = await target.request.get(`${base}/api/auth/session`);
  const openUser = (await openSession.json().catch(() => null))?.user;
  if (openUser?.email) throw new Error("a suspended member's open session still works");
  const blocked = await signInFresh(browser, base, target.email);
  await blocked.ctx.close();
  if (blocked.ok) throw new Error("a suspended member can still sign in");

  // Unsuspend restores access.
  await api(page, "POST", `${base}/api/admin-ops/users`, { targetId: targetRow.id, action: "unsuspend" });
  const back = await signInFresh(browser, base, target.email);
  await back.ctx.close();
  if (!back.ok) throw new Error("an unsuspended member still cannot sign in");

  // Granting admin really makes the reporter an admin — in their open session
  // (refreshed within a minute in production) and on any new sign-in.
  await api(page, "POST", `${base}/api/admin-ops/users`, { targetId: reporterRow.id, action: "grant_admin" });
  const live = await reporter.request.get(`${base}/api/admin-ops/users`);
  if (live.status() !== 200) throw new Error(`a member granted admin gets ${live.status()} in their open session`);
  const promoted = await signInFresh(browser, base, reporter.email);
  try {
    if (!promoted.ok) throw new Error("the promoted member could not sign in");
    const res = await promoted.page.request.get(`${base}/api/admin-ops/users`);
    if (res.status() !== 200) throw new Error(`a member granted admin still gets ${res.status()} from the admin user list`);
  } finally {
    await promoted.ctx.close();
  }

  // The audit trail shows who did what.
  const audit = await page.goto(`${base}/admin-ops/audit`);
  const text = await page.locator("body").innerText();
  for (const action of ["report.resolve", "user.unsuspend", "user.grant_admin"]) {
    if (!text.includes(action)) throw new Error(`audit log (status ${audit.status()}) lacks ${action}`);
  }
  await expectText(page, `${base}/admin-ops/reports?status=resolved`, "Spam messages", "the resolved report is listed");
}
