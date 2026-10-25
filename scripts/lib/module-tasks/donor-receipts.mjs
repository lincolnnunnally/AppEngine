// Receipts: a gift is recorded through the page's form with a plain value note
// and shows on the receipts list. Who gave what is private — another member must
// not see someone else's receipt — while the leader (owner) sees all of them.
import { api } from "./_helpers.mjs";
import { proveListModule } from "./inventory-shelf.mjs";

export async function task(ctx) {
  await proveListModule(ctx, {
    label: "receipts",
    path: "/receipts",
    apiPath: "/api/receipts",
    scope: "own",
    ownerEntry: { values: { donor: "Prove Owner Bakery", whatGiven: "40 loaves of bread", valueNote: "In-kind, est. $120", dateGiven: "2026-10-20" }, shows: "Prove Owner Bakery" },
    memberEntry: { values: { donor: "Prove Member Family", whatGiven: "Cash gift", valueNote: "$50 cash", dateGiven: "2026-10-22" }, shows: "Prove Member Family" }
  });
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/receipts`);
  const r = (records || []).find((x) => x.donor === "Prove Member Family");
  if (!r || r.whatGiven !== "Cash gift" || r.valueNote !== "$50 cash" || r.dateGiven !== "2026-10-22") throw new Error(`receipts: leader reads back ${JSON.stringify(r)}`);
  // A receipt with no donor is refused, not saved blank.
  const res = await ctx.page.request.post(`${ctx.base}/api/receipts`, { data: { whatGiven: "something" } });
  if (res.status() !== 400) throw new Error(`receipts: a receipt with no donor got ${res.status()}, expected 400`);
}
