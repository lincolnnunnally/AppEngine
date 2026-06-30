// Durable change requests a customer files against an app they already built.
// The account dashboard lets a signed-in customer say "change this about my app";
// we record the request so the owner can act on it (a real auto-build loop off
// these is a separate, heavier outward-facing build). Stored in Postgres on prod;
// an in-memory map backs local single-process dev. Mirrors build-jobs.ts.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

export type ChangeRequest = {
  id: string;
  jobId: string;
  projectId: string | null;
  userEmail: string;
  message: string;
  status: "new" | "in_review" | "done";
  createdAt: string | null;
};

const memory = new Map<string, ChangeRequest>();

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_change_requests (
          id text PRIMARY KEY,
          job_id text NOT NULL,
          project_id text,
          user_email text NOT NULL,
          message text NOT NULL,
          status text NOT NULL DEFAULT 'new',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
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

function rowToRequest(row: Record<string, unknown>): ChangeRequest {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    projectId: (row.project_id as string) ?? null,
    userEmail: String(row.user_email),
    message: String(row.message ?? ""),
    status: (row.status as ChangeRequest["status"]) ?? "new",
    createdAt: toIso(row.created_at)
  };
}

export async function createChangeRequest(input: {
  jobId: string;
  projectId: string | null;
  userEmail: string;
  message: string;
}): Promise<ChangeRequest> {
  const request: ChangeRequest = {
    id: `chg_${crypto.randomBytes(10).toString("hex")}`,
    jobId: input.jobId,
    projectId: input.projectId,
    userEmail: input.userEmail,
    message: input.message,
    status: "new",
    createdAt: new Date().toISOString()
  };

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      insert into app_change_requests (id, job_id, project_id, user_email, message, status)
      values (${request.id}, ${request.jobId}, ${request.projectId}, ${request.userEmail}, ${request.message}, 'new')
    `;
  } else {
    memory.set(request.id, request);
  }
  return request;
}

// All change requests a customer has filed, newest first — backs the dashboard.
export async function listChangeRequestsForUser(userEmail: string): Promise<ChangeRequest[]> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      select * from app_change_requests where user_email = ${userEmail} order by created_at desc
    `) as Array<Record<string, unknown>>;
    return rows.map(rowToRequest);
  }
  return [...memory.values()]
    .filter((request) => request.userEmail === userEmail)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
