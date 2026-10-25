// Shelf: a volunteer adds stock through the page's own form and sees it on the
// shelf straight away; the shelf is shared, so another member sees it too and
// what they add shows up for everyone. The job is "know what's on the shelf".
//
// Also exports proveListModule, the form-driven check shared by the other
// simple-list modules' scenarios (one copy, not five).
import { api, expectText } from "./_helpers.mjs";

// Fill the page's form like a person, submit it, and require the entry to show
// up in the list WITHOUT a manual reload (the form says it saved — the list must
// agree). Separately reloads so a refresh bug and a save bug read differently.
export async function submitForm(page, url, values, expectVisible, what) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const form = page.locator("main form").first();
  await form.waitFor({ timeout: 10000 });
  for (const [name, value] of Object.entries(values)) {
    await form.locator(`[name="${name}"]`).fill(String(value));
  }
  const pageErrors = [];
  const onError = (error) => pageErrors.push(String(error?.message || error));
  page.on("pageerror", onError);
  const posted = page.waitForResponse((res) => res.request().method() === "POST" && new URL(res.url()).pathname.startsWith("/api/"), { timeout: 15000 });
  await form.locator('button[type="submit"]').click();
  const res = await posted;
  if (!res.ok()) throw new Error(`${what}: form POST → ${res.status()} ${(await res.text()).slice(0, 200)}`);
  const shown = await page
    .locator("main")
    .getByText(expectVisible, { exact: false })
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  page.off("pageerror", onError);
  const button = await form.locator('button[type="submit"]').innerText().catch(() => "");
  if (!shown) {
    await page.reload({ waitUntil: "domcontentloaded" });
    const afterReload = (await page.locator("main").innerText()).includes(expectVisible);
    throw new Error(
      `${what}: saved (${res.status()}) but "${expectVisible}" ${afterReload ? "only appears after a manual reload" : "never appears in the list"}` +
        `; button reads "${button}"${pageErrors.length ? `; page error: ${pageErrors[0]}` : ""}`
    );
  }
  if (pageErrors.length) throw new Error(`${what}: page error after submit: ${pageErrors[0]}`);
  if (/saving/i.test(button)) throw new Error(`${what}: button stuck on "${button}" after a successful save`);
}

async function mainText(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return page.locator("main").innerText();
}

// scope "shared": everyone signed in sees every entry.
// scope "own": a member sees only their own entries; the owner/admin sees all.
export async function proveListModule({ page, base, newMember }, spec) {
  const { path, apiPath, scope, ownerEntry, memberEntry, label } = spec;
  const url = `${base}${path}`;

  // The owner saves one through the form.
  await submitForm(page, url, ownerEntry.values, ownerEntry.shows, `${label}: owner saves through the form`);

  // A member saves one through the form and sees it.
  const member = await newMember();
  await submitForm(member, url, memberEntry.values, memberEntry.shows, `${label}: member saves through the form`);

  const memberSees = await mainText(member, url);
  const memberApi = await api(member, "GET", `${base}${apiPath}`);
  const memberApiText = JSON.stringify(memberApi.records || []);
  if (scope === "shared") {
    if (!memberSees.includes(ownerEntry.shows)) throw new Error(`${label}: shared list, but a member does not see the owner's "${ownerEntry.shows}"`);
  } else {
    if (memberSees.includes(ownerEntry.shows) || memberApiText.includes(ownerEntry.shows)) {
      throw new Error(`${label}: private entries, but a member can see the owner's "${ownerEntry.shows}"`);
    }
  }

  // A second member: shared → sees both; own → sees neither of the others'.
  const other = await newMember();
  const otherSees = await mainText(other, url);
  const otherApiText = JSON.stringify((await api(other, "GET", `${base}${apiPath}`)).records || []);
  for (const entry of [ownerEntry, memberEntry]) {
    const sees = otherSees.includes(entry.shows) || otherApiText.includes(entry.shows);
    if (scope === "shared" && !otherSees.includes(entry.shows)) throw new Error(`${label}: shared list, but another member does not see "${entry.shows}"`);
    if (scope !== "shared" && sees) throw new Error(`${label}: private entries, but another member (${other.email}) can see "${entry.shows}"`);
  }

  // The owner (leader) sees everything, including the member's entry.
  await expectText(page, url, memberEntry.shows, `${label}: the owner sees the member's entry`);
  await expectText(page, url, ownerEntry.shows, `${label}: the owner still sees their own entry`);
  return { member, other };
}

export async function task(ctx) {
  await proveListModule(ctx, {
    label: "shelf",
    path: "/shelf",
    apiPath: "/api/shelf",
    scope: "shared",
    ownerEntry: { values: { name: "Prove Canned Beans", quantity: 24, useBy: "2026-12-01", notes: "Back row" }, shows: "Prove Canned Beans" },
    memberEntry: { values: { name: "Prove Rice Bags", quantity: 6, useBy: "2027-03-01" }, shows: "Prove Rice Bags" }
  });
  // Quantity and use-by are the point of a shelf — they must survive the save.
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/shelf`);
  const beans = (records || []).find((r) => r.name === "Prove Canned Beans");
  if (!beans) throw new Error("shelf: API list lacks the saved item");
  if (beans.quantity !== "24" || beans.useBy !== "2026-12-01") throw new Error(`shelf: saved quantity/use-by came back as ${beans.quantity}/${beans.useBy}`);
  await expectText(ctx.page, `${ctx.base}/shelf`, "2026-12-01", "shelf: the use-by date is shown on the shelf");
}
