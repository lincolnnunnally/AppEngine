// Communication: an admin drafts a broadcast and publishes it; a member
// receives it in the app; with no email keys the email copy is queued and the
// app says plainly that it was NOT sent (no fake "sent" counts).
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  const member = await newMember();
  const title = `Prove Potluck ${Date.now().toString(36)}`;
  const created = await api(page, "POST", `${base}/api/comms`, {
    title,
    body: "Bring a dish to share this Sunday.",
    location: "Fellowship Hall",
    channels: ["email"]
  });
  const id = created.broadcast?.id;
  if (!id) throw new Error("create broadcast returned no id");

  // Members only can't publish, and don't see a draft.
  const denied = await member.request.post(`${base}/api/comms/${id}`, { data: {} });
  if (denied.status() !== 403) throw new Error(`a member publishing got ${denied.status()}, expected 403`);
  await member.goto(`${base}/comms`);
  if ((await member.locator("body").innerText()).includes(title)) throw new Error("a member can see an unpublished draft");

  const published = await api(page, "POST", `${base}/api/comms/${id}`, {});
  if (published.status !== "scheduled") throw new Error(`publish left status ${published.status}`);
  if (published.emailConfigured !== false) throw new Error("emailConfigured should be false with no keys");
  if (!/not (?:been )?sent/i.test(String(published.message))) throw new Error(`publish message hides that email wasn't sent: ${published.message}`);

  // The member actually receives it in the app.
  await expectText(member, `${base}/comms`, "Bring a dish to share this Sunday.", "the member receives the broadcast in the app");
  const body = await member.locator("body").innerText();
  if (!body.includes(title)) throw new Error("the member's inbox lacks the broadcast title");

  // The admin sees the member's email queued — not sent — and the page says so.
  const detail = await api(page, "GET", `${base}/api/comms/${id}`);
  const emailRow = detail.recipients?.find((r) => r.channel === "email" && r.toEmail === member.email);
  if (!emailRow) throw new Error("no queued email for the member");
  if (emailRow.status !== "queued") throw new Error(`email shows ${emailRow.status} with no email provider configured`);
  await expectText(page, `${base}/comms/${id}`, "not sent", "the broadcast page says email was not sent");
}
