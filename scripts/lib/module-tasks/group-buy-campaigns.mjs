// Group buy: an organizer starts a group buy through the page's form, a member
// joins it (how many) through the page, the organizer sees the shared order —
// who is in and the total — and joining closes once the order has locked.
import { api, expectText } from "./_helpers.mjs";
import { submitForm } from "./inventory-shelf.mjs";

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function campaignByTitle(page, base, title) {
  const { records } = await api(page, "GET", `${base}/api/group-buy`);
  const found = (records || []).find((r) => r.title === title);
  if (!found) throw new Error(`group buy "${title}" not in the list`);
  return found;
}

export async function task({ page, base, newMember }) {
  const title = "Prove Bulk Rice Order";
  const lock = day(10);
  await submitForm(page, `${base}/group-buy`, { title, vendor: "Costco", lockDate: lock, notes: "25 lb bags" }, title, "group buy: organizer starts one through the form");
  await expectText(page, `${base}/group-buy`, `Locks ${lock}`, "group buy: the lock date shows");
  const { id } = await campaignByTitle(page, base, title);

  // A member finds it and joins through the page.
  const member = await newMember();
  await member.goto(`${base}/group-buy`, { waitUntil: "domcontentloaded" });
  const card = member.locator("article", { hasText: title });
  await card.locator('input[name="quantity"]').fill("3");
  const joined = member.waitForResponse((res) => res.url().endsWith(`/api/group-buy/${id}/join`), { timeout: 15000 });
  await card.getByRole("button", { name: "Join this group buy" }).click();
  const res = await joined;
  if (!res.ok()) throw new Error(`group buy: member join → ${res.status()} ${await res.text()}`);
  await card.getByText("You're in for 3").waitFor({ timeout: 8000 }).catch(() => {
    throw new Error("group buy: member joined but the page doesn't say they're in");
  });

  // The organizer sees the order: one person, three total, and who.
  await expectText(page, `${base}/group-buy`, "1 person in · 3 total", "group buy: organizer sees the order total");
  await expectText(page, `${base}/group-buy`, `${member.email} — 3`, "group buy: organizer sees who joined");

  // A second member joins via the API; they see the total but not the roster.
  const other = await newMember();
  await api(other, "POST", `${base}/api/group-buy/${id}/join`, { quantity: 2 });
  const otherView = await api(other, "GET", `${base}/api/group-buy/${id}`);
  if (otherView.campaign?.totalQuantity !== 5 || otherView.campaign?.members !== 2) throw new Error(`group buy: total after two joins reads ${JSON.stringify(otherView.campaign)}`);
  if (otherView.commitments) throw new Error("group buy: a plain member can read the organizer's roster");
  const organizerView = await api(page, "GET", `${base}/api/group-buy/${id}`);
  if ((organizerView.commitments || []).length !== 2) throw new Error(`group buy: organizer roster has ${(organizerView.commitments || []).length} people`);

  // Changing your mind: leave, and the total drops.
  await api(other, "POST", `${base}/api/group-buy/${id}/join`, { quantity: 0 });
  if ((await campaignByTitle(page, base, title)).totalQuantity !== 3) throw new Error("group buy: leaving didn't drop the total");

  // Once the order has locked, joining is refused (honestly, not silently).
  const locked = await api(page, "POST", `${base}/api/group-buy`, { title: "Prove Locked Order", lockDate: day(-2) });
  const late = await member.request.post(`${base}/api/group-buy/${locked.id}/join`, { data: { quantity: 1 } });
  if (late.status() !== 409) throw new Error(`group buy: joining a locked order got ${late.status()}, expected 409`);
  await expectText(member, `${base}/group-buy`, "This order has locked.", "group buy: a locked order says so");
}
