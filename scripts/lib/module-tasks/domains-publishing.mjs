// Domains: a member asks for a web address, the app says plainly that asking
// does not buy or connect it (no registrar is wired in tests), only the owner
// can mark it live, and the member sees the state the owner set. Members never
// see each other's requests.
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  const host = `prove-${Date.now()}.example.org`;
  const member = await newMember();

  // Ask through the page, the way a member would.
  await member.goto(`${base}/domains`, { waitUntil: "domcontentloaded" });
  const honest = await member.locator("main").innerText();
  if (!/does not buy or connect/i.test(honest)) throw new Error("the domains page does not say that requesting an address does not set it up");
  await member.fill('main input[name="hostname"]', host);
  await member.fill('main textarea[name="notes"]', "For our Sunday page.");
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith("/api/domains") && r.request().method() === "POST"),
    member.click("main form button[type=submit]")
  ]);
  await expectText(member, `${base}/domains`, host, "the member sees their request");

  const mine = await api(member, "GET", `${base}/api/domains`);
  const request = (mine.records || []).find((r) => r.hostname === host);
  if (!request) throw new Error("the member's request is not in their list");
  if (request.status !== "requested") throw new Error(`a fresh request reads "${request.status}", not "requested"`);

  // A member cannot claim their own address is live.
  const forgedHost = `forged${Date.now()}.example.net`;
  const forged = await member.request.post(`${base}/api/domains`, { data: { hostname: forgedHost, status: "live" } });
  const forgedList = await api(member, "GET", `${base}/api/domains`);
  const forgedRow = (forgedList.records || []).find((r) => r.hostname === forgedHost);
  if (forged.ok() && forgedRow && forgedRow.status === "live") throw new Error("a member marked their own address live");
  const patch = await member.request.patch(`${base}/api/domains`, { data: { id: request.id, status: "live" } });
  if (patch.status() !== 403) throw new Error(`a member's status change got ${patch.status()}, want 403`);

  // Garbage is refused rather than tracked as if it were an address.
  const bad = await member.request.post(`${base}/api/domains`, { data: { hostname: "not an address" } });
  if (bad.status() !== 400) throw new Error(`an invalid address got ${bad.status()}, want 400`);

  // Another member does not see it.
  const other = await newMember();
  const theirs = await api(other, "GET", `${base}/api/domains`);
  if ((theirs.records || []).some((r) => r.hostname === host)) throw new Error("another member sees this member's address request");

  // The owner sees who asked, and marks it live once it is set up.
  await expectText(page, `${base}/domains`, host, "the owner sees the request");
  await expectText(page, `${base}/domains`, member.email, "the owner sees who asked");
  await api(page, "PATCH", `${base}/api/domains`, { id: request.id, status: "live" });
  await member.goto(`${base}/domains`, { waitUntil: "domcontentloaded" });
  const card = await member.locator("main article", { hasText: host }).first().innerText();
  if (!/\blive\b/i.test(card)) throw new Error(`the member's card for ${host} does not show it live: "${card.replace(/\s+/g, " ")}"`);
  const after = await api(member, "GET", `${base}/api/domains`);
  if ((after.records || []).find((r) => r.id === request.id)?.status !== "live") throw new Error("status did not reach the member");
}
