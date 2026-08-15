// Central owner inbox — one place Lincoln can see every "I need help" from
// every app. Per-app admin dashboards stay where they are (staff / sale).
// This table is the cross-app queue. Counts only leak to the deck; the
// messages themselves stay owner-only. Self-creating table, in-memory
// fallback, same pattern as change-requests. SERVER ONLY.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { getAppOpsCatalogEntry } from "@/lib/engine/app-ops-catalog";
import { sendEmail } from "@/lib/solution-engine/notify";

export type InboxStatus = "open" | "in_progress" | "resolved";

export type InboxTicket = {
  id: string;
  appSlug: string;
  appName: string;
  subject: string;
  body: string;
  contactName: string;
  contactEmail: string;
  status: InboxStatus;
  source: string;
  ownerNote: string;
  notifyStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
};

export type InboxCounts = {
  open: number;
  inProgress: number;
  resolved: number;
  bySlug: Record<string, number>;
};

const memory = new Map<string, InboxTicket>();

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS ecosystem_inbox (
          id text PRIMARY KEY,
          app_slug text NOT NULL,
          app_name text NOT NULL DEFAULT '',
          subject text NOT NULL,
          body text NOT NULL,
          contact_name text NOT NULL DEFAULT '',
          contact_email text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'open',
          source text NOT NULL DEFAULT 'help_form',
          owner_note text NOT NULL DEFAULT '',
          notify_status text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          resolved_at timestamptz
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS ecosystem_inbox_status_idx ON ecosystem_inbox (status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS ecosystem_inbox_slug_idx ON ecosystem_inbox (app_slug, status)`;
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

function rowToTicket(row: Record<string, unknown>): InboxTicket {
  const status = String(row.status || "open");
  return {
    id: String(row.id),
    appSlug: String(row.app_slug || ""),
    appName: String(row.app_name || ""),
    subject: String(row.subject || ""),
    body: String(row.body || ""),
    contactName: String(row.contact_name || ""),
    contactEmail: String(row.contact_email || ""),
    status: status === "in_progress" || status === "resolved" ? status : "open",
    source: String(row.source || "help_form"),
    ownerNote: String(row.owner_note || ""),
    notifyStatus: String(row.notify_status || ""),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    resolvedAt: toIso(row.resolved_at)
  };
}

function displayNameFor(slug: string, provided?: string): string {
  if (provided && provided.trim()) return provided.trim();
  const catalog = getAppOpsCatalogEntry(slug);
  if (catalog) {
    return slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return slug || "Unknown app";
}

export function isValidInboxEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export async function createInboxTicket(input: {
  appSlug: string;
  appName?: string;
  subject: string;
  body: string;
  contactName?: string;
  contactEmail: string;
  source?: string;
}): Promise<InboxTicket> {
  const slug = input.appSlug.trim().toLowerCase().slice(0, 80) || "unknown";
  const ticket: InboxTicket = {
    id: `inb_${crypto.randomBytes(10).toString("hex")}`,
    appSlug: slug,
    appName: displayNameFor(slug, input.appName),
    subject: input.subject.trim().slice(0, 200),
    body: input.body.trim().slice(0, 8000),
    contactName: (input.contactName || "").trim().slice(0, 120),
    contactEmail: input.contactEmail.trim().toLowerCase().slice(0, 200),
    status: "open",
    source: (input.source || "help_form").slice(0, 40),
    ownerNote: "",
    notifyStatus: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null
  };

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      INSERT INTO ecosystem_inbox (
        id, app_slug, app_name, subject, body, contact_name, contact_email, status, source, owner_note, notify_status, created_at, updated_at
      ) VALUES (
        ${ticket.id}, ${ticket.appSlug}, ${ticket.appName}, ${ticket.subject}, ${ticket.body},
        ${ticket.contactName}, ${ticket.contactEmail}, ${ticket.status}, ${ticket.source},
        ${ticket.ownerNote}, ${ticket.notifyStatus}, now(), now()
      )
    `;
  } else {
    memory.set(ticket.id, ticket);
  }

  ticket.notifyStatus = await notifyOwner(ticket);
  if (useDb() && ticket.notifyStatus) {
    const sql = getDatabase();
    await sql`UPDATE ecosystem_inbox SET notify_status = ${ticket.notifyStatus}, updated_at = now() WHERE id = ${ticket.id}`;
  } else if (!useDb()) {
    memory.set(ticket.id, ticket);
  }

  return ticket;
}

async function notifyOwner(ticket: InboxTicket): Promise<string> {
  const to = (process.env.APP_ENGINE_OWNER_EMAIL || "").trim();
  if (!to) return "skipped: no APP_ENGINE_OWNER_EMAIL";
  const result = await sendEmail({
    to,
    subject: `[${ticket.appName}] ${ticket.subject}`,
    body: [
      `Someone needs help on ${ticket.appName}.`,
      "",
      `From: ${ticket.contactName || "(no name)"} <${ticket.contactEmail}>`,
      `App: ${ticket.appName} (${ticket.appSlug})`,
      `Source: ${ticket.source}`,
      "",
      ticket.body,
      "",
      `Open the inbox: https://dashboard.unitedundergod.org/inbox`
    ].join("\n")
  });
  return result.sent ? "sent" : `failed: ${result.reason || "email did not send"}`;
}

export async function listInboxTickets(filter?: {
  status?: InboxStatus | "all";
  slug?: string;
  limit?: number;
}): Promise<InboxTicket[]> {
  const status = filter?.status ?? "all";
  const slug = filter?.slug?.trim() || "";
  const limit = Math.min(200, Math.max(1, filter?.limit ?? 100));

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = slug
      ? status !== "all"
        ? await sql`SELECT * FROM ecosystem_inbox WHERE app_slug = ${slug} AND status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
        : await sql`SELECT * FROM ecosystem_inbox WHERE app_slug = ${slug} ORDER BY created_at DESC LIMIT ${limit}`
      : status !== "all"
        ? await sql`SELECT * FROM ecosystem_inbox WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
        : await sql`SELECT * FROM ecosystem_inbox ORDER BY created_at DESC LIMIT ${limit}`;
    return (rows as Array<Record<string, unknown>>).map(rowToTicket);
  }

  return [...memory.values()]
    .filter((ticket) => (slug ? ticket.appSlug === slug : true))
    .filter((ticket) => (status === "all" ? true : ticket.status === status))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

export async function getInboxTicket(id: string): Promise<InboxTicket | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = await sql`SELECT * FROM ecosystem_inbox WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToTicket(rows[0] as Record<string, unknown>) : null;
  }
  return memory.get(id) ?? null;
}

export async function updateInboxTicket(
  id: string,
  patch: { status?: InboxStatus; ownerNote?: string }
): Promise<InboxTicket | null> {
  const current = await getInboxTicket(id);
  if (!current) return null;
  const nextStatus = patch.status ?? current.status;
  const nextNote = patch.ownerNote !== undefined ? patch.ownerNote.slice(0, 4000) : current.ownerNote;
  const resolvedAt = nextStatus === "resolved" ? new Date().toISOString() : nextStatus === current.status ? current.resolvedAt : null;

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      UPDATE ecosystem_inbox
      SET status = ${nextStatus},
          owner_note = ${nextNote},
          resolved_at = ${resolvedAt},
          updated_at = now()
      WHERE id = ${id}
    `;
    return getInboxTicket(id);
  }

  const updated: InboxTicket = {
    ...current,
    status: nextStatus,
    ownerNote: nextNote,
    resolvedAt,
    updatedAt: new Date().toISOString()
  };
  memory.set(id, updated);
  return updated;
}

export async function getInboxCounts(): Promise<InboxCounts> {
  const tickets = await listInboxTickets({ status: "all", limit: 200 });
  const bySlug: Record<string, number> = {};
  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  for (const ticket of tickets) {
    if (ticket.status === "open") {
      open += 1;
      bySlug[ticket.appSlug] = (bySlug[ticket.appSlug] ?? 0) + 1;
    } else if (ticket.status === "in_progress") {
      inProgress += 1;
      bySlug[ticket.appSlug] = (bySlug[ticket.appSlug] ?? 0) + 1;
    } else {
      resolved += 1;
    }
  }
  return { open, inProgress, resolved, bySlug };
}
