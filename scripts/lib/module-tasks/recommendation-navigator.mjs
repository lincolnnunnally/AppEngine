// Next step: someone writes where a person is and the next faithful step
// through the page's form and sees it saved. It describes a person's life, so a
// member sees only their own; the leader (owner) sees everyone's to follow up.
import { api } from "./_helpers.mjs";
import { proveListModule } from "./inventory-shelf.mjs";

export async function task(ctx) {
  await proveListModule(ctx, {
    label: "next step",
    path: "/next-step",
    apiPath: "/api/next-step",
    scope: "own",
    ownerEntry: { values: { whereTheyAre: "New in town, looking for community", nextStep: "Prove owner: invite to small group", whoHelps: "Pastor Dan" }, shows: "Prove owner: invite to small group" },
    memberEntry: { values: { whereTheyAre: "Prove member: grieving a loss", nextStep: "Prove member: meet with care team", whoHelps: "Care team" }, shows: "Prove member: meet with care team" }
  });
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/next-step`);
  const entry = (records || []).find((r) => r.nextStep === "Prove member: meet with care team");
  if (!entry || entry.whereTheyAre !== "Prove member: grieving a loss" || entry.whoHelps !== "Care team") throw new Error(`next step: leader reads back ${JSON.stringify(entry)}`);
}
