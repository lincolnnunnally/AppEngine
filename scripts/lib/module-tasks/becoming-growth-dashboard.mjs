// Growth dashboard: a member journals, sets a goal and finishes it, and checks
// in — and their dashboard scores the week from exactly that, records the
// milestone, and keeps it private from other members. Pausing the streak shows.
import { api, expectText } from "./_helpers.mjs";

export async function task({ base, newMember }) {
  const member = await newMember();
  await api(member, "POST", `${base}/api/growth/journal`, { title: "Prove first page", content: "Today I showed up.", mood: "✿ Grateful" });
  await api(member, "POST", `${base}/api/growth/goals`, { title: "Prove read daily", description: "Ten pages a day." });
  const { goals } = await api(member, "GET", `${base}/api/growth/goals`);
  const goal = goals?.find((g) => g.title === "Prove read daily");
  if (!goal) throw new Error("the saved goal is not listed");
  await api(member, "PATCH", `${base}/api/growth/goals/${goal.id}`, { progress: 100 });
  await api(member, "POST", `${base}/api/growth/checkins`, { mood: "steady", note: "Good week." });

  const { dashboard } = await api(member, "GET", `${base}/api/growth`);
  const a = dashboard?.alignment;
  // journal +20, milestone +20, check-in +15, new goal +15 = 70.
  if (a?.score !== 70) throw new Error(`alignment score ${a?.score}, expected 70 (${JSON.stringify(a?.thisWeek)})`);
  if (a.thisWeek.milestones !== 1) throw new Error(`finishing a goal recorded ${a.thisWeek.milestones} milestones`);
  if (dashboard.goals.completed !== 1 || dashboard.goals.total !== 1) throw new Error(`goals ${dashboard.goals.completed}/${dashboard.goals.total}`);
  if (!dashboard.dailyPrompt.journaledToday) throw new Error("the dashboard says the member has not journaled today");
  if (a.streak < 1) throw new Error(`a week at ${a.score} (threshold ${dashboard.alignmentThreshold}) gives streak ${a.streak}`);

  await expectText(member, `${base}/growth`, "Showing up", "the member's dashboard shows the week's alignment");
  await expectText(member, `${base}/growth/journal`, "Today I showed up.", "the journal page shows the entry");
  await expectText(member, `${base}/growth/goals`, "Prove read daily", "the goals page lists the goal");
  // The status chip is CSS-uppercased, and innerText reflects that.
  if (!/complete ✓/i.test(await member.locator("body").innerText())) throw new Error("the goals page does not show the finished goal as complete");

  // Private: another member sees none of it.
  const other = await newMember();
  const theirs = await api(other, "GET", `${base}/api/growth/journal`);
  if (theirs.entries?.some((e) => e.title === "Prove first page")) throw new Error("another member can read this member's journal");
  const theirDash = (await api(other, "GET", `${base}/api/growth`)).dashboard;
  if (theirDash.alignment.score !== 0) throw new Error(`a fresh member scores ${theirDash.alignment.score}`);

  // Life happens: pause, see it, resume.
  await api(member, "POST", `${base}/api/growth/streak`, { action: "pause", days: 7, reason: "travel" });
  await expectText(member, `${base}/growth`, "Streak paused", "the paused streak shows");
  await api(member, "POST", `${base}/api/growth/streak`, { action: "resume" });
  const resumed = (await api(member, "GET", `${base}/api/growth`)).dashboard;
  if (resumed.pause) throw new Error("resume left the streak paused");
}
