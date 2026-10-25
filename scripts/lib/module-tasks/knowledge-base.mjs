// Knowledge base: the owner writes the help content from the app's own pages —
// a category, a problem with its symptoms, and a solution — and a member finds
// it both by browsing and through the troubleshooting wizard. Members cannot
// author. No solution shows ratings nobody gave (the module has no rating step).
import { api, expectText } from "./_helpers.mjs";

async function submit(page, buttonText, urlPart) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(urlPart) && r.request().method() === "POST"),
    page.click(`main button:has-text('${buttonText}')`)
  ]);
}

export async function task({ page, base, newMember }) {
  // Owner: category, then a problem with symptoms, from /knowledge-base.
  await page.goto(`${base}/knowledge-base`, { waitUntil: "domcontentloaded" });
  await page.fill('main input[name="categoryName"]', "Prove Sound Desk");
  await page.fill('main textarea[name="categoryDescription"]', "Microphones, speakers and the mixer.");
  await submit(page, "Add category", "/api/knowledge-base/categories");
  await page.goto(`${base}/knowledge-base`, { waitUntil: "domcontentloaded" });
  await page.selectOption('main select[name="problemCategory"]', { label: "Prove Sound Desk" });
  await page.fill('main input[name="problemTitle"]', "Prove speakers hum");
  await page.fill('main textarea[name="problemDescription"]', "A low hum comes through the speakers during the service.");
  await page.selectOption('main select[name="problemSeverity"]', "high");
  await page.fill('main textarea[name="problemSymptoms"]', "Prove low hum from speakers\nProve hum gets louder with lights on");
  await submit(page, "Add problem", "/api/knowledge-base");

  const cats = await api(page, "GET", `${base}/api/knowledge-base`);
  const category = (cats.categories || []).find((c) => c.name === "Prove Sound Desk");
  if (!category) throw new Error("the owner's category was not saved");
  const found = await api(page, "GET", `${base}/api/knowledge-base?category=${category.id}`);
  const problem = (found.problems || []).find((p) => p.title === "Prove speakers hum");
  if (!problem) throw new Error("the owner's problem was not saved in its category");

  // Owner: a solution on the problem page.
  await page.goto(`${base}/knowledge-base/problem/${problem.id}`, { waitUntil: "domcontentloaded" });
  await page.fill('main input[name="solutionTitle"]', "Prove ground the mixer");
  await page.fill('main textarea[name="solutionDescription"]', "Plug the mixer and the amp into the same circuit, then lift the ground on the DI box.");
  await page.fill('main input[name="solutionTools"]', "DI box, Extension cord");
  await submit(page, "Add solution", `/api/knowledge-base/problems/${problem.id}`);

  // Member: browse category → problem → solution.
  const member = await newMember();
  await expectText(member, `${base}/knowledge-base`, "Prove Sound Desk", "a member sees the category");
  await expectText(member, `${base}/knowledge-base/category/${category.id}`, "Prove speakers hum", "a member sees the problem in its category");
  await expectText(member, `${base}/knowledge-base/problem/${problem.id}`, "Prove ground the mixer", "a member sees the solution");
  await expectText(member, `${base}/knowledge-base/problem/${problem.id}`, "DI box", "a member sees the tools needed");

  // Member: the wizard finds the problem from a symptom.
  await member.goto(`${base}/knowledge-base/wizard`, { waitUntil: "domcontentloaded" });
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith("/api/knowledge-base/wizard") && r.request().method() === "POST"),
    member.click("main button:has-text('Prove low hum from speakers')")
  ]);
  await member.locator("main a:has-text('Prove speakers hum')").waitFor({ timeout: 10000 });

  // Members read; they do not author.
  const denied = await member.request.post(`${base}/api/knowledge-base/categories`, { data: { name: "Member Category" } });
  if (denied.status() !== 403) throw new Error(`a member created a category (${denied.status()})`);
  const denied2 = await member.request.post(`${base}/api/knowledge-base`, { data: { categoryId: category.id, title: "Member problem", description: "Not allowed here." } });
  if (denied2.status() !== 403) throw new Error(`a member created a problem (${denied2.status()})`);

  // No solution anywhere claims ratings — the module has no way to rate one.
  for (const c of (await api(member, "GET", `${base}/api/knowledge-base`)).categories || []) {
    for (const p of (await api(member, "GET", `${base}/api/knowledge-base?category=${c.id}`)).problems || []) {
      const detail = await api(member, "GET", `${base}/api/knowledge-base/problems/${p.id}`);
      const rated = (detail.solutions || []).find((s) => s.ratingCount > 0);
      if (rated) throw new Error(`"${rated.title}" shows ${rated.ratingCount} ratings (${rated.successRate}% worked) that nobody gave`);
    }
  }
}
