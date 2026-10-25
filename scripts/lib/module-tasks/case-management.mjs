// Case management: a member opens a case, documents an event, files a
// document, records an agreement and accepts it; the court-ready summary
// reflects only what was documented (never invented claims on an empty case);
// the app owner can review it; another member cannot see it.
import { api, expectText } from "./_helpers.mjs";

// Phrases the summary must never assert without evidence behind them.
const UNSUPPORTED = [/without escalation/i, /Shared participation documented(?! across)/i, /completion rate/i];

async function summaryText(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return page.locator("main").innerText();
}

export async function task({ page, base, newMember }) {
  const member = await newMember();

  // Start a case on the page, the way the member would.
  await member.goto(`${base}/cases`, { waitUntil: "domcontentloaded" });
  await member.fill('main input[name="caseName"]', "Prove Family Plan");
  await member.fill('main input[name="childName"]', "Avery");
  await Promise.all([member.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 15000 }), member.click("main form button[type=submit]")]);
  const caseId = new URL(member.url()).pathname.split("/").pop();

  // An empty case's court-ready summary claims nothing.
  const empty = await summaryText(member, `${base}/cases/${caseId}`);
  for (const phrase of UNSUPPORTED) {
    if (phrase.test(empty)) throw new Error(`court-ready summary of an empty case asserts "${empty.match(phrase)[0]}"`);
  }

  // Document the case through the workspace forms.
  await member.fill('main input[name="title"]', "Prove Saturday exchange");
  await member.fill('main input[name="description"]', "On time at the library.");
  await member.selectOption('main select[name="eventType"]', "exchange");
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith(`/api/cases/${caseId}/events`) && r.request().method() === "POST"),
    member.click("main button:has-text('Add event')")
  ]);
  await member.fill('main input[name="name"]', "Prove Parenting Plan.pdf");
  await member.fill('main input[name="url"]', "https://example.com/plan.pdf");
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith(`/api/cases/${caseId}/documents`) && r.request().method() === "POST"),
    member.click("main button:has-text('Add document')")
  ]);
  await api(member, "POST", `${base}/api/cases/${caseId}/agreements`, { topic: "Prove Summer Week" });
  const pending = await api(member, "GET", `${base}/api/cases/${caseId}/agreements`);
  const agreement = (pending.agreements || []).find((a) => a.topic === "Prove Summer Week");
  if (!agreement || agreement.status !== "Pending Approval") throw new Error("a new agreement is not pending approval");
  await member.goto(`${base}/cases/${caseId}`, { waitUntil: "domcontentloaded" });
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith(`/api/cases/${caseId}/agreements`) && r.request().method() === "PATCH"),
    member.click("main button:has-text('Accept')")
  ]);

  const full = await summaryText(member, `${base}/cases/${caseId}`);
  for (const text of ["Prove Saturday exchange", "Prove Parenting Plan.pdf", "Prove Summer Week", "Accepted", "1 of 1 agreements accepted"]) {
    if (!full.includes(text)) throw new Error(`the member's case page is missing "${text}"`);
  }
  for (const phrase of UNSUPPORTED) {
    if (phrase.test(full)) throw new Error(`court-ready summary asserts "${full.match(phrase)[0]}" with no evidence for it`);
  }

  // A document link must be a real web link, not a script.
  const evil = await member.request.post(`${base}/api/cases/${caseId}/documents`, { data: { name: "x.pdf", url: "javascript:alert(1)" } });
  const docs = await api(member, "GET", `${base}/api/cases/${caseId}/documents`);
  if (evil.ok() && (docs.documents || []).some((d) => /^javascript:/i.test(d.url))) throw new Error("a javascript: document link was saved");

  // The owner can review the case; another member cannot see it.
  await expectText(page, `${base}/cases`, "Prove Family Plan", "the owner sees the member's case");
  await expectText(page, `${base}/cases/${caseId}`, "Prove Saturday exchange", "the owner sees the timeline");
  const other = await newMember();
  const theirs = await api(other, "GET", `${base}/api/cases`);
  if ((theirs.cases || []).some((c) => c.id === caseId)) throw new Error("another member lists this member's case");
  const peek = await other.goto(`${base}/cases/${caseId}`, { waitUntil: "domcontentloaded" });
  if (peek && peek.status() !== 404) throw new Error(`another member opened the case page (status ${peek.status()})`);
  const write = await other.request.post(`${base}/api/cases/${caseId}/events`, { data: { title: "Forged event" } });
  if (write.ok()) throw new Error("another member added an event to this case");
}
