// Intake: a person tells the app what needs to change through the page's own
// form and sees it saved; what they share is theirs — another member must not
// see it — while the leader (owner) sees everyone's to act on.
import { api } from "./_helpers.mjs";
import { proveListModule } from "./inventory-shelf.mjs";

export async function task(ctx) {
  const { member } = await proveListModule(ctx, {
    label: "intake",
    path: "/intake",
    apiPath: "/api/intake",
    scope: "own",
    ownerEntry: { values: { problem: "Prove owner: volunteers miss the schedule", whoFor: "Volunteers", outcome: "know when to serve" }, shows: "Prove owner: volunteers miss the schedule" },
    memberEntry: { values: { problem: "Prove member: no ride to Sunday service", whoFor: "My family", outcome: "get to church", barriers: "No car" }, shows: "Prove member: no ride to Sunday service" }
  });
  // The structured parts survive and read back to the leader.
  const { records } = await api(ctx.page, "GET", `${ctx.base}/api/intake`);
  const mine = (records || []).find((r) => r.problem.startsWith("Prove member"));
  if (!mine || mine.whoFor !== "My family" || mine.outcome !== "get to church" || mine.barriers !== "No car") {
    throw new Error(`intake: leader reads back ${JSON.stringify(mine)}`);
  }
  // A too-short problem is refused honestly, not saved.
  const res = await member.request.post(`${ctx.base}/api/intake`, { data: { problem: "short", whoFor: "x", outcome: "y" } });
  if (res.status() !== 400) throw new Error(`intake: a 5-character problem got ${res.status()}, expected 400`);
}
