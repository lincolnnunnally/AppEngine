// AI assist with no AI key configured (tests never call a provider): the job is
// to say plainly that it is not set up — never a fake answer, never a fake
// history entry, never a fake usage/cost line on the owner's ledger.
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  const member = await newMember();
  await expectText(member, `${base}/ai-assist`, "has not connected an AI key yet", "a member is told AI is not set up");
  const generate = member.locator("main form button[type=submit]");
  if (!(await generate.isDisabled())) throw new Error("the Generate button is clickable with no AI key");

  // Asking anyway: an honest refusal, no output.
  const res = await member.request.post(`${base}/api/ai-assist`, { data: { feature: "draft", prompt: "Write a welcome note for new members." } });
  const json = await res.json().catch(() => ({}));
  if (res.status() !== 503 || json.ok !== false || json.configured !== false) {
    throw new Error(`generate with no key → ${res.status()} ${JSON.stringify(json).slice(0, 200)} (want 503, ok:false, configured:false)`);
  }
  if (json.output) throw new Error("generate with no key returned output text");
  if (!/AI key/i.test(String(json.message || ""))) throw new Error(`refusal message is not plain: "${json.message}"`);

  // Nothing was saved for the member, and the owner's ledger shows no usage.
  const history = await api(member, "GET", `${base}/api/ai-assist`);
  if (history.configured !== false) throw new Error("history reports AI as configured");
  if ((history.generations || []).length !== 0) throw new Error(`member has ${history.generations.length} generations they never made`);
  const usage = await api(page, "GET", `${base}/api/ai-assist/usage`);
  if (usage.summary?.totalCalls !== 0 || usage.summary?.totalCost !== 0) {
    throw new Error(`owner's AI ledger shows ${usage.summary?.totalCalls} calls / $${usage.summary?.totalCost} though AI was never called`);
  }
  await expectText(page, `${base}/ai-assist/usage`, "No AI usage recorded yet", "the owner's ledger is honestly empty");

  // The ledger is the owner's, not the member's.
  const denied = await member.request.get(`${base}/api/ai-assist/usage`);
  if (denied.status() !== 403) throw new Error(`a member reads the AI cost ledger (${denied.status()})`);
}
