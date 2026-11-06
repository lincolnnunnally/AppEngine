import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countTasks, mergeTask, needsCheck, normalizeTaskInput, parseTaskFile, safeLink, sortTasks, sortTasksBy, taskLinkLabel, type OwnerTask } from "./owner-tasks-core.ts";

function definition(overrides: Record<string, unknown> = {}) {
  const result = normalizeTaskInput({ app: "churchconnect", title: "Create the Stripe live key", priority: "blocker", kind: "credential", ...overrides });
  if (!result.ok) throw new Error(result.message);
  return result.task;
}

describe("owner task input", () => {
  it("derives a stable id from app + title so re-posts do not duplicate", () => {
    assert.equal(definition().id, "churchconnect-create-the-stripe-live-key");
    assert.equal(definition({ title: "Create  the Stripe LIVE key" }).id, "churchconnect-create-the-stripe-live-key");
  });

  it("defaults unknown kind/priority/status instead of failing", () => {
    const task = definition({ kind: "nonsense", priority: "urgent!!", status: "whatever" });
    assert.equal(task.kind, "other");
    assert.equal(task.priority, "recommended");
    assert.equal(task.status, "open");
  });

  it("rejects a task with no real title", () => {
    assert.equal(normalizeTaskInput({ title: "x" }).ok, false);
    assert.equal(normalizeTaskInput(null).ok, false);
  });

  it("only allows https/http or in-dashboard links", () => {
    assert.equal(safeLink("javascript:alert(1)"), null);
    assert.equal(safeLink("//evil.example"), null);
    assert.equal(safeLink("/integrations"), "/integrations");
    assert.equal(safeLink("https://dashboard.stripe.com/apikeys"), "https://dashboard.stripe.com/apikeys");
  });

  it("puts tasks without an app under ecosystem", () => {
    assert.equal(definition({ app: "" }).appSlug, "ecosystem");
  });
});

describe("owner task file", () => {
  it("reports bad entries and duplicate ids without dropping good ones", () => {
    const parsed = parseTaskFile({
      tasks: [
        { id: "a", title: "Pay the Vercel invoice" },
        { id: "a", title: "Pay the Vercel invoice again" },
        { title: "" }
      ]
    });
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.errors.length, 2);
  });

  it("refuses a file with the wrong shape", () => {
    assert.equal(parseTaskFile([]).errors.length, 1);
  });
});

describe("merging an ask into what is stored", () => {
  const now = "2026-11-01T12:00:00.000Z";

  it("never reopens a task the owner closed", () => {
    const stored: OwnerTask = { ...mergeTask(null, definition(), "file", now), status: "done", doneAt: now, ownerNote: "did it" };
    const merged = mergeTask(stored, definition({ why: "reworded" }), "file", "2026-11-02T00:00:00.000Z");
    assert.equal(merged.status, "done");
    assert.equal(merged.ownerNote, "did it");
    assert.equal(merged.why, "reworded");
  });

  it("lets an agent close a task it verified as finished", () => {
    const stored = mergeTask(null, definition(), "file", now);
    const merged = mergeTask(stored, definition({ status: "done" }), "file", "2026-11-02T00:00:00.000Z");
    assert.equal(merged.status, "done");
    assert.equal(merged.doneAt, "2026-11-02T00:00:00.000Z");
  });

  it("keeps the owner's waiting state when the agent re-posts open", () => {
    const stored: OwnerTask = { ...mergeTask(null, definition(), "file", now), status: "waiting" };
    assert.equal(mergeTask(stored, definition(), "file", now).status, "waiting");
  });
});

describe("ordering and counts", () => {
  it("lists active blockers first and counts per app", () => {
    const now = "2026-11-01T00:00:00.000Z";
    const tasks = [
      { ...mergeTask(null, definition({ title: "Optional thing", priority: "optional" }), "file", now) },
      { ...mergeTask(null, definition({ title: "Done thing" }), "file", now), status: "done" as const },
      { ...mergeTask(null, definition({ title: "Blocking thing", app: "operate" }), "file", now) }
    ];
    const sorted = sortTasks(tasks);
    assert.equal(sorted[0].title, "Blocking thing");
    assert.equal(sorted[2].title, "Done thing");
    const counts = countTasks(tasks);
    assert.deepEqual(counts, { open: 2, blockers: 1, waiting: 0, done: 1, wrong: 0, unchecked: 2, bySlug: { churchconnect: 1, operate: 1 } });
  });
});

describe("accuracy (owner request 2026-11-06)", () => {
  const now = "2026-11-06T12:00:00.000Z";

  it("keeps when and how an agent checked the ask", () => {
    const task = definition({ verifiedOn: "2026-11-05", verifiedHow: "Vercel env list shows STRIPE_SECRET_KEY missing" });
    assert.equal(task.verifiedOn, "2026-11-05");
    assert.match(task.verifiedHow, /Vercel env/);
    assert.equal(definition({ verifiedOn: "yesterday" }).verifiedOn, null);
  });

  it("flags asks nobody has checked, or checked too long ago", () => {
    assert.equal(needsCheck({ verifiedOn: null }, new Date(now)), true);
    assert.equal(needsCheck({ verifiedOn: "2026-11-01" }, new Date(now)), false);
    assert.equal(needsCheck({ verifiedOn: "2026-10-01" }, new Date(now)), true);
  });

  it("a task marked wrong stays off the list when an agent merely re-posts it", () => {
    const flagged: OwnerTask = { ...mergeTask(null, definition({ verifiedOn: "2026-11-01" }), "file", now), status: "wrong", doneAt: now };
    assert.equal(mergeTask(flagged, definition({ verifiedOn: "2026-11-01" }), "file", now).status, "wrong");
  });

  it("comes back only after an agent fixes and re-checks it on or after the flag", () => {
    const flagged: OwnerTask = { ...mergeTask(null, definition(), "file", now), status: "wrong", doneAt: now };
    const fixed = mergeTask(flagged, definition({ why: "corrected", verifiedOn: "2026-11-06", verifiedHow: "checked the live page" }), "file", now);
    assert.equal(fixed.status, "open");
    assert.equal(fixed.doneAt, null);
    assert.equal(fixed.why, "corrected");
  });

  it("counts wrong and unchecked asks separately", () => {
    const tasks = [
      mergeTask(null, definition({ title: "Checked ask", verifiedOn: "2026-11-05" }), "file", now),
      mergeTask(null, definition({ title: "Unchecked ask" }), "file", now),
      { ...mergeTask(null, definition({ title: "Bad ask" }), "file", now), status: "wrong" as const }
    ];
    const counts = countTasks(tasks, new Date(now));
    assert.equal(counts.wrong, 1);
    assert.equal(counts.unchecked, 1);
    assert.equal(counts.open, 2);
  });

  it("sorts by newest, oldest and app", () => {
    const a = { ...mergeTask(null, definition({ title: "Aaa task", app: "zeta" }), "file", "2026-11-01T00:00:00.000Z") };
    const b = { ...mergeTask(null, definition({ title: "Bbb task", app: "alpha", priority: "optional" }), "file", "2026-11-05T00:00:00.000Z") };
    assert.equal(sortTasksBy([a, b], "importance")[0].title, "Aaa task");
    assert.equal(sortTasksBy([a, b], "newest")[0].title, "Bbb task");
    assert.equal(sortTasksBy([a, b], "oldest")[0].title, "Aaa task");
    assert.equal(sortTasksBy([a, b], "app")[0].appSlug, "alpha");
  });

  it("says where the button goes", () => {
    assert.equal(taskLinkLabel("https://dashboard.stripe.com/apikeys"), "Open dashboard.stripe.com ↗");
    assert.equal(taskLinkLabel("https://www.bing.com/webmasters"), "Open bing.com ↗");
    assert.equal(taskLinkLabel("/integrations"), "Open it here →");
  });
});
