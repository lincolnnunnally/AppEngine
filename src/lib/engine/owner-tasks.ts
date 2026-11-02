// Owner to-do list — storage. Same pattern as the central inbox: a
// self-creating table, an in-memory fallback without a database, owner-only
// reads. SERVER ONLY.
//
// Two ways a task gets here:
//   1. source-of-truth/owner-tasks.json — the git-tracked list. Any agent in
//      any repo can add an ask with a normal PR to AppEngine main. It is
//      synced into the table once per server process.
//   2. POST /api/engine/owner-tasks with a bearer token, for apps and agents
//      that hold APP_ENGINE_TASKS_TOKEN (or the inbox token).
// The owner's own clicks (done / waiting / not doing / notes) live only in the
// table, so a re-sync of the file never undoes them. See mergeTask.
import taskFileJson from "../../../source-of-truth/owner-tasks.json";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { sendEmail } from "@/lib/solution-engine/notify";
import {
  countTasks,
  mergeTask,
  parseTaskFile,
  sortTasks,
  type OwnerTask,
  type OwnerTaskCounts,
  type OwnerTaskDefinition,
  type OwnerTaskOrigin,
  type OwnerTaskStatus
} from "@/lib/engine/owner-tasks-core";

// Shared on globalThis so the API route and the pages see the same list when
// there is no database (Next can load this module once per bundle).
const memoryHolder = globalThis as typeof globalThis & { __ownerTasksMemory?: Map<string, OwnerTask> };
const memory = (memoryHolder.__ownerTasksMemory ??= new Map<string, OwnerTask>());

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

type Sql = ReturnType<typeof getDatabase>;

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: Sql): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS owner_tasks (
          id text PRIMARY KEY,
          app_slug text NOT NULL DEFAULT 'ecosystem',
          title text NOT NULL,
          why text NOT NULL DEFAULT '',
          steps jsonb NOT NULL DEFAULT '[]'::jsonb,
          kind text NOT NULL DEFAULT 'other',
          priority text NOT NULL DEFAULT 'recommended',
          status text NOT NULL DEFAULT 'open',
          link text,
          source text NOT NULL DEFAULT '',
          requested_by text NOT NULL DEFAULT '',
          owner_note text NOT NULL DEFAULT '',
          origin text NOT NULL DEFAULT 'api',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          done_at timestamptz
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS owner_tasks_status_idx ON owner_tasks (status, priority)`;
      await sql`CREATE INDEX IF NOT EXISTS owner_tasks_slug_idx ON owner_tasks (app_slug, status)`;
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToTask(row: Record<string, unknown>): OwnerTask {
  const steps = Array.isArray(row.steps) ? row.steps.map(String) : [];
  return {
    id: String(row.id),
    appSlug: String(row.app_slug || "ecosystem"),
    title: String(row.title || ""),
    why: String(row.why || ""),
    steps,
    kind: String(row.kind || "other") as OwnerTask["kind"],
    priority: String(row.priority || "recommended") as OwnerTask["priority"],
    status: String(row.status || "open") as OwnerTaskStatus,
    link: row.link ? String(row.link) : null,
    source: String(row.source || ""),
    requestedBy: String(row.requested_by || ""),
    ownerNote: String(row.owner_note || ""),
    origin: String(row.origin || "api") as OwnerTaskOrigin,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    doneAt: toIso(row.done_at)
  };
}

async function readOne(sql: Sql | null, id: string): Promise<OwnerTask | null> {
  if (!sql) return memory.get(id) ?? null;
  const rows = await sql`SELECT * FROM owner_tasks WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToTask(rows[0] as Record<string, unknown>) : null;
}

async function write(sql: Sql | null, task: OwnerTask): Promise<void> {
  if (!sql) {
    memory.set(task.id, task);
    return;
  }
  await sql`
    INSERT INTO owner_tasks (
      id, app_slug, title, why, steps, kind, priority, status, link, source, requested_by,
      owner_note, origin, created_at, updated_at, done_at
    ) VALUES (
      ${task.id}, ${task.appSlug}, ${task.title}, ${task.why}, ${JSON.stringify(task.steps)}::jsonb,
      ${task.kind}, ${task.priority}, ${task.status}, ${task.link}, ${task.source}, ${task.requestedBy},
      ${task.ownerNote}, ${task.origin}, ${task.createdAt ?? new Date().toISOString()}::timestamptz,
      ${task.updatedAt ?? new Date().toISOString()}::timestamptz, ${task.doneAt}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      app_slug = EXCLUDED.app_slug,
      title = EXCLUDED.title,
      why = EXCLUDED.why,
      steps = EXCLUDED.steps,
      kind = EXCLUDED.kind,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      link = EXCLUDED.link,
      source = EXCLUDED.source,
      requested_by = EXCLUDED.requested_by,
      owner_note = EXCLUDED.owner_note,
      updated_at = EXCLUDED.updated_at,
      done_at = EXCLUDED.done_at
  `;
}

function sameDefinition(a: OwnerTask, b: OwnerTask): boolean {
  return (
    a.appSlug === b.appSlug &&
    a.title === b.title &&
    a.why === b.why &&
    JSON.stringify(a.steps) === JSON.stringify(b.steps) &&
    a.kind === b.kind &&
    a.priority === b.priority &&
    a.link === b.link &&
    a.source === b.source &&
    a.requestedBy === b.requestedBy &&
    a.status === b.status
  );
}

/** Merge one definition into storage. Returns the stored task and whether it is new. */
async function upsertDefinition(
  sql: Sql | null,
  definition: OwnerTaskDefinition,
  origin: OwnerTaskOrigin
): Promise<{ task: OwnerTask; created: boolean }> {
  const existing = await readOne(sql, definition.id);
  const merged = mergeTask(existing, definition, existing?.origin ?? origin, new Date().toISOString());
  if (existing && sameDefinition(existing, merged)) {
    return { task: existing, created: false };
  }
  await write(sql, merged);
  return { task: merged, created: !existing };
}

// ── File sync ───────────────────────────────────────────────────────────────

const fileParse = parseTaskFile(taskFileJson);
let fileSynced: Promise<void> | null = null;

/** Problems in source-of-truth/owner-tasks.json, shown on /tasks so they are not silent. */
export function ownerTaskFileErrors(): string[] {
  return fileParse.errors;
}

async function syncFile(): Promise<void> {
  if (!fileSynced) {
    fileSynced = (async () => {
      const sql = useDb() ? getDatabase() : null;
      if (sql) await ensureTable(sql);
      for (const definition of fileParse.tasks) {
        await upsertDefinition(sql, definition, "file");
      }
    })().catch((error) => {
      fileSynced = null;
      throw error;
    });
  }
  return fileSynced;
}

async function ready(): Promise<Sql | null> {
  await syncFile();
  if (!useDb()) return null;
  const sql = getDatabase();
  await ensureTable(sql);
  return sql;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function listOwnerTasks(filter?: { slug?: string; includeClosed?: boolean }): Promise<OwnerTask[]> {
  const sql = await ready();
  const slug = filter?.slug?.trim() || "";
  let tasks: OwnerTask[];
  if (sql) {
    const rows = slug
      ? await sql`SELECT * FROM owner_tasks WHERE app_slug = ${slug} ORDER BY created_at DESC LIMIT 500`
      : await sql`SELECT * FROM owner_tasks ORDER BY created_at DESC LIMIT 500`;
    tasks = (rows as Array<Record<string, unknown>>).map(rowToTask);
  } else {
    tasks = [...memory.values()].filter((task) => (slug ? task.appSlug === slug : true));
  }
  if (!filter?.includeClosed) {
    // Closed tasks stay visible for 30 days so the owner can see what got done.
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    tasks = tasks.filter(
      (task) => task.status === "open" || task.status === "waiting" || (task.doneAt ? Date.parse(task.doneAt) > cutoff : false)
    );
  }
  return sortTasks(tasks);
}

export async function getOwnerTaskCounts(): Promise<OwnerTaskCounts> {
  return countTasks(await listOwnerTasks());
}

/**
 * Add or refresh an ask. Re-posting the same id updates the wording but never
 * reopens something the owner closed. A brand-new blocker emails the owner.
 */
export async function submitOwnerTask(
  definition: OwnerTaskDefinition,
  origin: OwnerTaskOrigin
): Promise<{ task: OwnerTask; created: boolean; notify: string }> {
  const sql = await ready();
  const result = await upsertDefinition(sql, definition, origin);
  let notify = "";
  if (result.created && origin === "api" && result.task.priority === "blocker") {
    notify = await notifyOwner(result.task);
  }
  return { ...result, notify };
}

export async function updateOwnerTask(
  id: string,
  patch: { status?: OwnerTaskStatus; ownerNote?: string }
): Promise<OwnerTask | null> {
  const sql = await ready();
  const current = await readOne(sql, id);
  if (!current) return null;
  const status = patch.status ?? current.status;
  const closing = (status === "done" || status === "dismissed") && status !== current.status;
  const reopening = (status === "open" || status === "waiting") && (current.status === "done" || current.status === "dismissed");
  const next: OwnerTask = {
    ...current,
    status,
    ownerNote: patch.ownerNote !== undefined ? patch.ownerNote.slice(0, 4000) : current.ownerNote,
    doneAt: closing ? new Date().toISOString() : reopening ? null : current.doneAt,
    updatedAt: new Date().toISOString()
  };
  await write(sql, next);
  return next;
}

async function notifyOwner(task: OwnerTask): Promise<string> {
  const to = (process.env.APP_ENGINE_OWNER_EMAIL || "").trim();
  if (!to) return "skipped: no APP_ENGINE_OWNER_EMAIL";
  const result = await sendEmail({
    to,
    subject: `[To do] ${task.title}`,
    body: [
      `An agent needs you to do something only you can do.`,
      "",
      task.title,
      task.why ? `Why: ${task.why}` : "",
      ...task.steps.map((step, index) => `${index + 1}. ${step}`),
      task.link ? `Do it here: ${task.link}` : "",
      "",
      `Asked by: ${task.requestedBy || "an agent"}${task.source ? ` (${task.source})` : ""}`,
      "",
      "Your to-do list: https://dashboard.unitedundergod.org/tasks"
    ]
      .filter((line) => line !== "")
      .join("\n")
  });
  return result.sent ? "sent" : `failed: ${result.reason || "email did not send"}`;
}
