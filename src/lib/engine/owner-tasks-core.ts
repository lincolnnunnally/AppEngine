// Owner to-do list — the pure part. No fetch, no env, no `@/` imports, so
// `node --test` exercises the real module.
//
// Why this exists: agents kept asking Lincoln to do things (create a key, pay
// for a plan, make a product call) inside long chat replies, and the asks got
// buried. Every ask now becomes a row on the dashboard that stays until he
// marks it done.
//
// What belongs here (authority model, 2026-07-09): only things Lincoln alone
// can do — money, credentials only he can create, and mission/product
// decisions — plus any hand step an agent truly cannot do itself. Technical
// work agents can do themselves never goes on this list.

export const OWNER_TASK_KINDS = ["money", "credential", "decision", "account", "other"] as const;
export const OWNER_TASK_PRIORITIES = ["blocker", "recommended", "optional"] as const;
export const OWNER_TASK_STATUSES = ["open", "waiting", "done", "dismissed", "wrong"] as const;

export type OwnerTaskKind = (typeof OWNER_TASK_KINDS)[number];
export type OwnerTaskPriority = (typeof OWNER_TASK_PRIORITIES)[number];
export type OwnerTaskStatus = (typeof OWNER_TASK_STATUSES)[number];
/** Where the task came from: the git-tracked list, an API post, or typed in by the owner. */
export type OwnerTaskOrigin = "file" | "api" | "owner";

export type OwnerTask = {
  id: string;
  appSlug: string; // app-ops-catalog slug, or "ecosystem" for cross-app asks
  title: string;
  why: string; // what stays blocked until it is done
  steps: string[];
  kind: OwnerTaskKind;
  priority: OwnerTaskPriority;
  status: OwnerTaskStatus;
  link: string | null; // where to actually do it
  source: string; // file / PR / session that asked
  requestedBy: string; // which agent or app asked
  verifiedOn: string | null; // YYYY-MM-DD an agent last confirmed the ask is still needed and correct
  verifiedHow: string; // what the agent actually checked (live setting, env var, page) — not "I believe"
  ownerNote: string;
  origin: OwnerTaskOrigin;
  createdAt: string | null;
  updatedAt: string | null;
  doneAt: string | null;
};

/** The fields an agent or app supplies. Status is optional (defaults to open). */
export type OwnerTaskDefinition = Omit<OwnerTask, "ownerNote" | "origin" | "createdAt" | "updatedAt" | "doneAt">;

export type OwnerTaskCounts = {
  open: number;
  blockers: number;
  waiting: number;
  done: number;
  wrong: number; // Lincoln marked the ask wrong; an agent must fix and re-check it
  unchecked: number; // active asks with no recent verification
  bySlug: Record<string, number>; // open + waiting per app
};

const PRIORITY_RANK: Record<OwnerTaskPriority, number> = { blocker: 0, recommended: 1, optional: 2 };
const STATUS_RANK: Record<OwnerTaskStatus, number> = { open: 0, waiting: 1, done: 2, dismissed: 3, wrong: 4 };

export const KIND_LABEL: Record<OwnerTaskKind, string> = {
  money: "Money",
  credential: "Key or login",
  decision: "Your decision",
  account: "Account setup",
  other: "Hand step"
};

export const PRIORITY_LABEL: Record<OwnerTaskPriority, string> = {
  blocker: "Blocking",
  recommended: "Should do",
  optional: "When you can"
};

export function isActiveStatus(status: OwnerTaskStatus): boolean {
  return status === "open" || status === "waiting";
}

export const STATUS_LABEL: Record<OwnerTaskStatus, string> = {
  open: "To do",
  waiting: "Waiting",
  done: "Done",
  dismissed: "Not doing",
  wrong: "Marked wrong"
};

/** An ask is trusted for this long after an agent last checked it against the real thing. */
export const VERIFIED_FRESH_DAYS = 14;

/** True when no agent has confirmed this ask recently, so the owner should read it with care. */
export function needsCheck(task: Pick<OwnerTask, "verifiedOn">, now: Date): boolean {
  if (!task.verifiedOn) return true;
  const checked = Date.parse(`${task.verifiedOn}T00:00:00Z`);
  if (!Number.isFinite(checked)) return true;
  return now.getTime() - checked > VERIFIED_FRESH_DAYS * 24 * 60 * 60 * 1000;
}

function isoDay(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim().slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`)) ? raw : null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function taskSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Only http(s) URLs and in-dashboard paths are allowed as links. */
export function safeLink(value: unknown): string | null {
  const raw = text(value, 500);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Validate one incoming task (from the JSON file or an API post). With no id,
 * the id is derived from app + title so re-posting the same ask is idempotent
 * instead of creating a duplicate.
 */
export function normalizeTaskInput(
  raw: unknown
): { ok: true; task: OwnerTaskDefinition } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "A task must be an object." };
  const input = raw as Record<string, unknown>;
  const title = text(input.title, 160);
  if (title.length < 4) return { ok: false, message: "A task needs a title (what to do, in plain words)." };
  const appSlug = taskSlug(text(input.app ?? input.appSlug, 80)) || "ecosystem";
  const id = taskSlug(text(input.id, 80)) || taskSlug(`${appSlug}-${title}`);
  const steps = Array.isArray(input.steps)
    ? input.steps.map((step) => text(step, 400)).filter(Boolean).slice(0, 12)
    : [];
  return {
    ok: true,
    task: {
      id,
      appSlug,
      title,
      why: text(input.why, 600),
      steps,
      kind: pick(input.kind, OWNER_TASK_KINDS, "other"),
      priority: pick(input.priority, OWNER_TASK_PRIORITIES, "recommended"),
      status: pick(input.status, OWNER_TASK_STATUSES, "open"),
      link: safeLink(input.link),
      source: text(input.source, 300),
      requestedBy: text(input.requestedBy, 120),
      verifiedOn: isoDay(input.verifiedOn),
      verifiedHow: text(input.verifiedHow, 400)
    }
  };
}

/** Validate the whole git-tracked file. Returns valid tasks plus readable errors. */
export function parseTaskFile(raw: unknown): { tasks: OwnerTaskDefinition[]; errors: string[] } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { tasks?: unknown }).tasks)
    ? ((raw as { tasks: unknown[] }).tasks)
    : null;
  if (!list) return { tasks: [], errors: ['The file must look like { "tasks": [ ... ] }.'] };
  const tasks: OwnerTaskDefinition[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  list.forEach((entry, index) => {
    const result = normalizeTaskInput(entry);
    if (!result.ok) {
      errors.push(`tasks[${index}]: ${result.message}`);
      return;
    }
    if (seen.has(result.task.id)) {
      errors.push(`tasks[${index}]: duplicate id "${result.task.id}"`);
      return;
    }
    seen.add(result.task.id);
    tasks.push(result.task);
  });
  return { tasks, errors };
}

/**
 * Merge an incoming definition into what is stored. The text of the ask comes
 * from the agent; the status belongs to the owner. An incoming done/dismissed
 * (an agent that verified the work was finished) may close an active task, but
 * an incoming "open" never reopens something the owner already closed.
 */
export function mergeTask(existing: OwnerTask | null, incoming: OwnerTaskDefinition, origin: OwnerTaskOrigin, now: string): OwnerTask {
  if (!existing) {
    const closed = !isActiveStatus(incoming.status);
    return {
      ...incoming,
      ownerNote: "",
      origin,
      createdAt: now,
      updatedAt: now,
      doneAt: closed ? now : null
    };
  }
  const agentCloses = isActiveStatus(existing.status) && !isActiveStatus(incoming.status);
  // Lincoln marked it wrong. It comes back only when an agent has fixed it AND
  // re-checked it on or after the day it was flagged.
  const flaggedDay = existing.doneAt ? existing.doneAt.slice(0, 10) : "";
  const fixedAfterFlag =
    existing.status === "wrong" && isActiveStatus(incoming.status) && Boolean(incoming.verifiedOn) && incoming.verifiedOn! >= flaggedDay;
  return {
    ...existing,
    appSlug: incoming.appSlug,
    title: incoming.title,
    why: incoming.why,
    steps: incoming.steps,
    kind: incoming.kind,
    priority: incoming.priority,
    link: incoming.link,
    source: incoming.source || existing.source,
    requestedBy: incoming.requestedBy || existing.requestedBy,
    verifiedOn: incoming.verifiedOn ?? existing.verifiedOn,
    verifiedHow: incoming.verifiedOn ? incoming.verifiedHow : existing.verifiedHow,
    status: fixedAfterFlag ? "open" : agentCloses ? incoming.status : existing.status,
    doneAt: fixedAfterFlag ? null : agentCloses ? now : existing.doneAt,
    updatedAt: now
  };
}

/** Active first, blockers first, newest first inside a rank. */
export function sortTasks(tasks: OwnerTask[]): OwnerTask[] {
  return [...tasks].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export function countTasks(tasks: OwnerTask[], now = new Date()): OwnerTaskCounts {
  const counts: OwnerTaskCounts = { open: 0, blockers: 0, waiting: 0, done: 0, wrong: 0, unchecked: 0, bySlug: {} };
  for (const task of tasks) {
    if (task.status === "open") {
      counts.open += 1;
      if (task.priority === "blocker") counts.blockers += 1;
    } else if (task.status === "waiting") {
      counts.waiting += 1;
    } else if (task.status === "done") {
      counts.done += 1;
    } else if (task.status === "wrong") {
      counts.wrong += 1;
    }
    if (isActiveStatus(task.status)) {
      counts.bySlug[task.appSlug] = (counts.bySlug[task.appSlug] ?? 0) + 1;
      if (needsCheck(task, now)) counts.unchecked += 1;
    }
  }
  return counts;
}

export const SORT_MODES = ["importance", "newest", "oldest", "app"] as const;
export type OwnerTaskSort = (typeof SORT_MODES)[number];

export const SORT_LABEL: Record<OwnerTaskSort, string> = {
  importance: "Most important",
  newest: "Newest",
  oldest: "Oldest",
  app: "By app"
};

/** Order a list the way the owner asked. Ties fall back to importance, then newest. */
export function sortTasksBy(tasks: OwnerTask[], mode: OwnerTaskSort, appName: (slug: string) => string = (slug) => slug): OwnerTask[] {
  const base = sortTasks(tasks);
  if (mode === "importance") return base;
  const index = new Map(base.map((task, position) => [task.id, position]));
  const tie = (a: OwnerTask, b: OwnerTask) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
  const copy = [...base];
  if (mode === "newest") return copy.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || tie(a, b));
  if (mode === "oldest") return copy.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") || tie(a, b));
  return copy.sort((a, b) => appName(a.appSlug).localeCompare(appName(b.appSlug)) || tie(a, b));
}

/** What a task's button says, so it is clear where it goes. */
export function taskLinkLabel(link: string): string {
  if (link.startsWith("/")) return "Open it here →";
  try {
    return `Open ${new URL(link).hostname.replace(/^www\./, "")} ↗`;
  } catch {
    return "Open it ↗";
  }
}
