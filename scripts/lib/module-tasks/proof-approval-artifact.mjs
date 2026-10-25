// Proof & approval: the owner submits a proof, the customer opens the sign-off
// link and either asks for changes or approves it, and the owner sees that
// state. Approval locks the proof (a second sign-off is refused). A fresh app
// must not already hold sign-offs nobody gave.
import { api, expectText } from "./_helpers.mjs";

async function createProof(page, base, title, spec) {
  await page.goto(`${base}/proofs`, { waitUntil: "domcontentloaded" });
  await page.fill('main input[name="title"]', title);
  await page.fill('main textarea[name="description"]', "Check the wording and the date.");
  await page.fill('main textarea[name="snapshot"]', spec);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/proofs") && r.request().method() === "POST"),
    page.click("main button:has-text('Create proof')")
  ]);
  await page.getByText("Share this sign-off link").waitFor({ timeout: 10000 });
  const list = await api(page, "GET", `${base}/api/proofs`);
  const proof = (list.proofs || []).find((p) => p.title === title);
  if (!proof?.proofCode) throw new Error(`proof "${title}" was not saved with a code`);
  return proof;
}

export async function task({ page, base, newMember }) {
  const before = await api(page, "GET", `${base}/api/proofs`);
  const invented = (before.proofs || []).filter((p) => p.approvalCount > 0);
  if (invented.length) throw new Error(`a fresh app already shows ${invented.length} signed-off proof(s) nobody signed: "${invented[0].title}"`);

  const customer = await newMember();

  // 1. Customer asks for changes; the owner sees the request and what to change.
  const first = await createProof(page, base, "Prove Banner Draft", "Welcome Home Sunday");
  await expectText(customer, `${base}/proof/${first.proofCode}`, "Welcome Home Sunday", "the customer sees exactly what they are approving");
  await customer.fill('main textarea[name="changes"]', "Prove: make the date bigger");
  await Promise.all([
    customer.waitForResponse((r) => r.url().includes(`/api/proofs/code/${first.proofCode}`) && r.request().method() === "POST"),
    customer.click("main button:has-text('Request changes')")
  ]);
  await expectText(customer, `${base}/proof/${first.proofCode}`, "You asked for changes", "the customer sees their change request recorded");
  await expectText(page, `${base}/proofs/${first.id}`, "Prove: make the date bigger", "the owner sees what to change");
  const firstNow = await api(page, "GET", `${base}/api/proofs/${first.id}`);
  if (firstNow.proof?.approvalCount !== 0) throw new Error("a change request counted as a sign-off");
  const late = await customer.request.post(`${base}/api/proofs/code/${first.proofCode}`, { data: { approvedByName: "Late Signer" } });
  if (late.ok()) throw new Error("a proof with changes requested could still be signed off as-is");

  // 2. Revised proof: customer approves it, and it locks.
  const second = await createProof(page, base, "Prove Banner Final", "Welcome Home Sunday — date large");
  await customer.goto(`${base}/proof/${second.proofCode}`, { waitUntil: "domcontentloaded" });
  await customer.fill('main input[aria-label="Your name"]', "Prove Customer");
  await customer.check('main input[type="checkbox"]');
  await Promise.all([
    customer.waitForResponse((r) => r.url().includes(`/api/proofs/code/${second.proofCode}`) && r.request().method() === "POST"),
    customer.click("main button:has-text('Approve')")
  ]);
  await expectText(customer, `${base}/proof/${second.proofCode}`, "Approved by Prove Customer", "the customer sees their sign-off");
  await expectText(page, `${base}/proofs/${second.id}`, "Signed off by Prove Customer", "the owner sees who signed off");
  await page.goto(`${base}/proofs`, { waitUntil: "domcontentloaded" });
  const card = await page.locator("main a.wide-card", { hasText: "Prove Banner Final" }).first().innerText();
  if (!/approved/i.test(card) || !/signed off by Prove Customer/i.test(card)) throw new Error(`the owner's list card does not show the approval: "${card.replace(/\s+/g, " ")}"`);
  const draftCard = await page.locator("main a.wide-card", { hasText: "Prove Banner Draft" }).first().innerText();
  if (!/changes requested/i.test(draftCard)) throw new Error(`the owner's list card does not show the change request: "${draftCard.replace(/\s+/g, " ")}"`);
  const again = await customer.request.post(`${base}/api/proofs/code/${second.proofCode}`, { data: { approvedByName: "Someone Else" } });
  if (again.ok()) throw new Error("an approved proof was signed off a second time");
  const sealed = await api(page, "GET", `${base}/api/proofs/${second.id}`);
  if (sealed.proof?.approvedByName !== "Prove Customer") throw new Error(`sign-off name changed to "${sealed.proof?.approvedByName}"`);
}
