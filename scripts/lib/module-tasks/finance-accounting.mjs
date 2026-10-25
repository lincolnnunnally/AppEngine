// Finance: the treasurer (admin) sets a budget, records a paid bill against it,
// a bill coming due, and a gift dated today — and the books show exactly that:
// budget spent / remaining, the overview's income, expenses and net for the
// period (today included), the upcoming bill, and the giving report — with no
// numbers the church never entered. Members cannot read or write the church's
// books. The job is "the treasurer can trust the numbers".
import { api, expectText } from "./_helpers.mjs";

async function status(page, method, url, body) {
  const res = await page.request.fetch(url, {
    method,
    data: body === undefined ? undefined : body,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    maxRedirects: 0
  });
  return res.status();
}

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function task({ page, base, newMember }) {
  const year = new Date().getFullYear();

  // 0. A fresh app's books are empty — nothing invented.
  const before = await api(page, "GET", `${base}/api/finance/giving?year=${year}`);
  if ((before.giving || []).length) throw new Error(`a new app's books already hold ${(before.giving || []).length} gifts nobody recorded (${before.giving.map((g) => g.donorName).join(", ")})`);
  const budgetsBefore = await api(page, "GET", `${base}/api/finance/budgets?year=${year}`);
  if ((budgetsBefore.budgets || []).length) throw new Error(`a new app already has ${(budgetsBefore.budgets || []).length} budget lines nobody set`);

  // 1. Budget: $100/month for Utilities → $1,200 for the year.
  await api(page, "POST", `${base}/api/finance/budgets`, { category: "Utilities", allocatedAmount: 100, period: "monthly", year });

  // 2. A paid electric bill today, and a pending bill due next week.
  const paid = (await api(page, "POST", `${base}/api/finance/expenses`, { vendor: "Prove Power Co", amount: 300, date: localDate(0), category: "Utilities", paymentStatus: "Paid" })).expense;
  const due = (await api(page, "POST", `${base}/api/finance/expenses`, { vendor: "Prove Water Dept", amount: 50, date: localDate(7), category: "Utilities", paymentStatus: "Pending" })).expense;
  if (!paid?.id || !due?.id) throw new Error("recording an expense returned no id");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paid.date)) throw new Error(`an expense's date reads back as "${paid.date}", not a date`);

  // 3. A gift recorded today.
  await api(page, "POST", `${base}/api/finance/giving`, { donorName: "Prove Donor", amount: 500, date: localDate(0), fund: "General", paymentMethod: "check", checkNumber: "1001" });

  // Budget performance: spent counts only PAID Utilities expenses.
  const budgets = (await api(page, "GET", `${base}/api/finance/budgets?year=${year}`)).budgets || [];
  const utilities = budgets.find((b) => b.category === "Utilities");
  if (!utilities || utilities.annualBudget !== 1200 || utilities.spent !== 300 || utilities.remaining !== 900) {
    throw new Error(`Utilities budget reads ${JSON.stringify(utilities && { annual: utilities.annualBudget, spent: utilities.spent, remaining: utilities.remaining })}, expected 1200 / 300 / 900`);
  }
  await expectText(page, `${base}/finance/budgets`, "Spent $300", "the budget page shows what was spent");
  await expectText(page, `${base}/finance/budgets`, "Remaining $900", "the budget page shows what is left");

  // Overview for the month: today's gift and today's bill are in it.
  await page.goto(`${base}/finance?period=month`, { waitUntil: "domcontentloaded" });
  const overview = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  for (const [pattern, what] of [
    [/Total income ?\$500(?![\d,])/i, "income includes today's gift"],
    [/Total expenses ?\$300(?![\d,])/i, "expenses include today's bill"],
    [/Net income ?\$200(?![\d,])/i, "net income is income minus expenses"],
    [/Prove Power Co - Utilities/, "today's bill is in recent transactions"],
    [/Gift - General/, "today's gift is in recent transactions"],
    [/Prove Water Dept/, "the bill coming due is under upcoming bills"]
  ]) {
    if (!pattern.test(overview)) throw new Error(`finance overview: ${what} (${pattern} not found)`);
  }

  // Marking the pending bill paid moves it out of upcoming bills.
  await api(page, "PATCH", `${base}/api/finance/expenses/${due.id}`, { paymentStatus: "Paid" });
  await page.goto(`${base}/finance?period=month`, { waitUntil: "domcontentloaded" });
  if ((await page.locator("body").innerText()).includes("Due " + localDate(7))) throw new Error("a paid bill is still listed as upcoming");

  // Giving report: exactly what was recorded.
  const report = (await api(page, "GET", `${base}/api/finance/giving?year=${year}`)).report;
  if (report?.totalGiving !== 500 || report?.totalGifts !== 1 || report?.uniqueGivers !== 1) {
    throw new Error(`giving report reads ${JSON.stringify(report && { total: report.totalGiving, gifts: report.totalGifts, givers: report.uniqueGivers })}, expected 500 / 1 / 1`);
  }
  await expectText(page, `${base}/finance/giving`, "Prove Donor", "the giver is on the giving report");

  // Members cannot read or write the church's books.
  const member = await newMember();
  for (const path of ["/api/finance/giving", "/api/finance/expenses", "/api/finance/budgets"]) {
    if ((await status(member, "GET", `${base}${path}`)) < 400) throw new Error(`a member can read ${path}`);
  }
  if ((await status(member, "POST", `${base}/api/finance/giving`, { donorName: "Fake", amount: 1000000, date: localDate(0) })) < 400) throw new Error("a member can add a gift to the church's books");
  if ((await status(member, "PATCH", `${base}/api/finance/expenses/${paid.id}`, { paymentStatus: "Pending" })) < 400) throw new Error("a member can change an expense's status");
  await member.goto(`${base}/finance/giving`, { waitUntil: "domcontentloaded" });
  if ((await member.locator("body").innerText()).includes("Prove Donor")) throw new Error("a member can see who gave on the giving report");
  const after = (await api(page, "GET", `${base}/api/finance/giving?year=${year}`)).report;
  if (after?.totalGiving !== 500) throw new Error(`the church's giving total changed to ${after?.totalGiving} after a member's attempt`);
}
