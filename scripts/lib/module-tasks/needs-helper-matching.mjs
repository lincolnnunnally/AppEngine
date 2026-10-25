// Needs & helper matching: one member asks for help, another offers, and the
// safety-coded hand-off happens between them — the person being helped can see
// the code to confirm who is at the door, only the matched helper can check in
// (and only with the right code), checking out completes the need, and a safety
// concern reaches the admins. The job is "someone in need gets a safe helper".
import { api, expectText } from "./_helpers.mjs";

async function status(page, method, url, body) {
  const res = await page.request.fetch(url, {
    method,
    data: body === undefined ? undefined : body,
    headers: body === undefined ? undefined : { "content-type": "application/json" }
  });
  return res.status();
}

// Status labels are styled uppercase (innerText follows CSS), so match them
// case-insensitively.
async function expectStatus(page, url, label, what) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const body = (await page.locator("body").innerText()).toLowerCase();
  if (!body.includes(label.toLowerCase())) throw new Error(`${what}: "${label}" not on ${new URL(url).pathname}`);
}

export async function task({ page, base, newMember }) {
  const asker = await newMember();
  const helper = await newMember();
  const bystander = await newMember();

  // 1. A member posts a need; others see it on the board.
  const need = (await api(asker, "POST", `${base}/api/needs`, {
    title: "Ride to a doctor's appointment",
    description: "Tuesday morning, back by noon.",
    category: "transportation",
    urgency: "high",
    city: "Riverside"
  })).need;
  if (!need?.id) throw new Error("posting a need returned no id");
  await expectText(helper, `${base}/needs`, "Ride to a doctor's appointment", "another member sees the need on the board");

  // 2. The asker cannot "help" themselves.
  if ((await status(asker, "POST", `${base}/api/needs/${need.id}/match`, {})) < 400) throw new Error("the asker was matched as the helper on their own need");

  // 3. Another member offers help and gets a safety code; the need is taken.
  const match = (await api(helper, "POST", `${base}/api/needs/${need.id}/match`, { scheduledDate: "Tuesday 9am" })).match;
  if (!match?.id || !/^[A-Z0-9]{6}$/.test(match.safetyCode || "")) throw new Error(`offering help returned no usable safety code (${match?.safetyCode})`);
  if ((await status(bystander, "POST", `${base}/api/needs/${need.id}/match`, {})) < 400) throw new Error("a second helper matched a need that was already taken");
  await expectText(bystander, `${base}/needs/${need.id}`, "already been matched", "the need shows as taken");

  // 4. Both sides see the hand-off; the asker sees the code to confirm the helper.
  await expectText(helper, `${base}/needs/my-matches`, match.safetyCode, "the helper sees their safety code");
  await expectText(asker, `${base}/needs/my-matches`, "is helping", "the asker sees who is helping");
  await expectText(asker, `${base}/needs/my-matches`, match.safetyCode, "the asker sees the safety code to confirm the helper at the door");

  // 5. Check-in: only the matched helper, only with the right code.
  if ((await status(bystander, "POST", `${base}/api/needs/matches/${match.id}/checkin`, { safetyCode: match.safetyCode })) < 400) throw new Error("someone other than the helper checked in");
  if ((await status(helper, "POST", `${base}/api/needs/matches/${match.id}/checkin`, { safetyCode: "WRONG1" })) < 400) throw new Error("check-in accepted a wrong safety code");
  await api(helper, "POST", `${base}/api/needs/matches/${match.id}/checkin`, { safetyCode: match.safetyCode.toLowerCase() });
  await expectStatus(asker, `${base}/needs/my-matches`, "checked in", "the asker sees the helper has arrived");

  // 6. Check-out completes the need; it leaves the open board.
  if ((await status(bystander, "POST", `${base}/api/needs/matches/${match.id}/checkin`, { action: "check_out" })) < 400) throw new Error("someone other than the helper checked out");
  await api(helper, "POST", `${base}/api/needs/matches/${match.id}/checkin`, { action: "check_out" });
  await expectStatus(asker, `${base}/needs/my-matches`, "completed", "the asker sees the hand-off completed");
  const board = await api(helper, "GET", `${base}/api/needs`);
  if ((board.needs || []).some((n) => n.id === need.id)) throw new Error("a completed need is still on the open board");
  const done = await api(helper, "GET", `${base}/api/needs?status=completed`);
  if (!(done.needs || []).some((n) => n.id === need.id)) throw new Error("the need is not marked completed");

  // 7. The asker raises a safety concern from their hand-off page; it reaches
  //    the admins (and only the admins).
  await asker.goto(`${base}/needs/my-matches`, { waitUntil: "domcontentloaded" });
  const reportButton = asker.getByRole("button", { name: "Report a concern" });
  if (!(await reportButton.count())) throw new Error("there is no way to report a concern from a hand-off");
  await reportButton.first().click();
  await asker.getByLabel("What happened").fill("Helper arrived 40 minutes late.");
  await asker.getByRole("button", { name: "Send report" }).click();
  await asker.getByText("an administrator will review").waitFor({ timeout: 10000 }).catch(() => {
    throw new Error("sending a safety report did not confirm");
  });
  if ((await status(asker, "GET", `${base}/api/needs/reports`)) < 400) throw new Error("a member can read the safety-report queue");
  const reports = await api(page, "GET", `${base}/api/needs/reports`);
  if (!(reports.reports || []).some((r) => r.description === "Helper arrived 40 minutes late." && r.matchId === match.id)) throw new Error("the admin does not see the safety report");
  await expectText(page, `${base}/needs/reports`, "Helper arrived 40 minutes late.", "the admin sees the report in the safety queue");
  await asker.goto(`${base}/needs/reports`, { waitUntil: "domcontentloaded" });
  if ((await asker.locator("body").innerText()).includes("Helper arrived 40 minutes late.")) throw new Error("a member can open the safety-report queue page");
}
