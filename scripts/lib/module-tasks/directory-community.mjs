// Directory: the admin adds someone to the people directory from the app's own
// directory page (not by hand-written API calls), a member finds them by
// searching and opens their profile, and members cannot add or change entries.
// The job is "people can find each other".
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  // 1. The admin adds a person through the page's form.
  await page.goto(`${base}/directory`, { waitUntil: "domcontentloaded" });
  const form = page.locator("form", { has: page.locator('input[name="firstName"]') });
  if (!(await form.count())) throw new Error("the admin has no way to add a person on /directory");
  await form.locator('input[name="firstName"]').fill("Prudence");
  await form.locator('input[name="lastName"]').fill("Provewell");
  await form.locator('input[name="email"]').fill("prudence@example.com");
  await form.locator('input[name="phone"]').fill("555-0142");
  await form.locator('input[name="title"]').fill("Worship Leader");
  await form.locator('input[name="city"]').fill("Riverside");
  await form.locator("button[type=submit]").click();
  await page.waitForFunction(() => document.body.innerText.includes("Provewell"), null, { timeout: 15000 }).catch(() => {});
  await expectText(page, `${base}/directory`, "Prudence Provewell", "the admin sees the person they added");

  // 2. A member searches, finds them, and opens the profile.
  const member = await newMember();
  await expectText(member, `${base}/directory?q=provewell`, "Prudence Provewell", "a member finds the person by search");
  const found = await api(member, "GET", `${base}/api/directory?q=provewell`);
  const person = (found.people || []).find((p) => p.lastName === "Provewell");
  if (!person) throw new Error("search API does not return the person");
  if (person.dataQualityScore < 80) throw new Error(`a nearly complete record scores ${person.dataQualityScore}`);
  await expectText(member, `${base}/directory/${person.id}`, "555-0142", "the member sees the person's phone on their profile");
  await expectText(member, `${base}/directory/${person.id}`, "Worship Leader", "the member sees the person's role");

  // 3. Editing by the same email updates the one record (no duplicates).
  await api(page, "POST", `${base}/api/directory`, { firstName: "Prudence", lastName: "Provewell", email: "PRUDENCE@example.com", phone: "555-0199", city: "Riverside" });
  const after = await api(member, "GET", `${base}/api/directory?q=provewell`);
  if ((after.people || []).length !== 1) throw new Error(`updating by email left ${(after.people || []).length} records`);
  if (after.people[0].phone !== "555-0199") throw new Error("updating by email did not change the phone");

  // 4. A member cannot add people, and sees no add form.
  const res = await member.request.post(`${base}/api/directory`, { data: { firstName: "Mallory", lastName: "Member" } });
  if (res.status() < 400) throw new Error(`a member added a directory entry (${res.status()})`);
  await member.goto(`${base}/directory`, { waitUntil: "domcontentloaded" });
  if (await member.locator('input[name="firstName"]').count()) throw new Error("a member is shown the add-person form");
}
