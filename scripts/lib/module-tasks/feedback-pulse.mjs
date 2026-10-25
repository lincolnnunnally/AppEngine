// Pulse: a member names a real issue through the page's form and sees it saved;
// the leader (owner) sees it — that is the point, leaders not flying blind —
// while other members don't read each other's notes.
import { api } from "./_helpers.mjs";
import { proveListModule } from "./inventory-shelf.mjs";

export async function task(ctx) {
  await proveListModule(ctx, {
    label: "pulse",
    path: "/pulse",
    apiPath: "/api/pulse",
    scope: "own",
    ownerEntry: { values: { title: "Prove owner: parking lot light out", detail: "North corner is dark", place: "Parking lot", status: "open" }, shows: "Prove owner: parking lot light out" },
    memberEntry: { values: { title: "Prove member: nursery is understaffed", detail: "Only one volunteer at 9am", place: "Nursery", status: "open" }, shows: "Prove member: nursery is understaffed" }
  });
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/pulse`);
  const r = (records || []).find((x) => x.title === "Prove member: nursery is understaffed");
  if (!r || r.detail !== "Only one volunteer at 9am" || r.place !== "Nursery") throw new Error(`pulse: leader reads back ${JSON.stringify(r)}`);
}
