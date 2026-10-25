// Waitlist: someone is added to the waitlist (name, place, need) through the
// page's form and shows on it. Names and needs are private — another member must
// not see them — while the leader (owner) sees the whole list to invite from.
import { api } from "./_helpers.mjs";
import { proveListModule } from "./inventory-shelf.mjs";

export async function task(ctx) {
  await proveListModule(ctx, {
    label: "waitlist",
    path: "/waitlist",
    apiPath: "/api/waitlist",
    scope: "own",
    ownerEntry: { values: { name: "Prove Owner Garcia family", place: "30310", need: "Weekly groceries", status: "waiting" }, shows: "Prove Owner Garcia family" },
    memberEntry: { values: { name: "Prove Member Lee", place: "Westside", need: "Diapers", status: "waiting" }, shows: "Prove Member Lee" }
  });
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/waitlist`);
  const r = (records || []).find((x) => x.name === "Prove Member Lee");
  if (!r || r.place !== "Westside" || r.need !== "Diapers") throw new Error(`waitlist: leader reads back ${JSON.stringify(r)}`);
}
