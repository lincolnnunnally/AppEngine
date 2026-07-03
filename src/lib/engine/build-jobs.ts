// Durable state for an async customer build (kick off -> generate -> deploy ->
// poll -> live URL). A full build exceeds one serverless function's budget, so
// /api/build/start records a job, runs the work in the background, and the client
// polls /api/build/status. Stored in Postgres on prod (survives across the
// background run + status polls); an in-memory map backs local single-process dev.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

export type BuildJobStatus = "building" | "deploying" | "live" | "failed";

export type BuildJob = {
  id: string;
  projectId: string | null;
  userEmail: string;
  idea: string;
  status: BuildJobStatus;
  deploymentId: string | null;
  url: string | null;
  error: string | null;
  vercelProject: string | null;
  // Per-app ops token: injected into the deployed app as APP_ENGINE_STATS_TOKEN
  // and presented as a bearer token when the ops collector polls its stats.
  statsToken: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const memory = new Map<string, BuildJob>();

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_build_jobs (
          id text PRIMARY KEY,
          project_id text,
          user_email text NOT NULL,
          idea text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'building',
          deployment_id text,
          url text,
          error text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      // Self-applying column add for tables created before the domain step shipped
      // (Vercel won't expose the prod connection string, so migrations run at runtime).
      await sql`ALTER TABLE app_build_jobs ADD COLUMN IF NOT EXISTS vercel_project text`;
      await sql`ALTER TABLE app_build_jobs ADD COLUMN IF NOT EXISTS stats_token text`;
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

export function newJobId() {
  return `job_${crypto.randomBytes(10).toString("hex")}`;
}

function rowToJob(row: Record<string, unknown>): BuildJob {
  return {
    id: String(row.id),
    projectId: (row.project_id as string) ?? null,
    userEmail: String(row.user_email),
    idea: String(row.idea ?? ""),
    status: (row.status as BuildJobStatus) ?? "building",
    deploymentId: (row.deployment_id as string) ?? null,
    url: (row.url as string) ?? null,
    error: (row.error as string) ?? null,
    vercelProject: (row.vercel_project as string) ?? null,
    statsToken: (row.stats_token as string) ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function createBuildJob(userEmail: string, idea: string): Promise<BuildJob> {
  const now = new Date().toISOString();
  const job: BuildJob = {
    id: newJobId(),
    projectId: null,
    userEmail,
    idea,
    status: "building",
    deploymentId: null,
    url: null,
    error: null,
    vercelProject: null,
    statsToken: null,
    createdAt: now,
    updatedAt: now
  };

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`insert into app_build_jobs (id, user_email, idea, status) values (${job.id}, ${userEmail}, ${idea}, 'building')`;
  } else {
    memory.set(job.id, job);
  }
  return job;
}

export async function getBuildJob(id: string): Promise<BuildJob | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`select * from app_build_jobs where id = ${id} limit 1`) as Array<Record<string, unknown>>;
    return rows.length ? rowToJob(rows[0]) : null;
  }
  return memory.get(id) ?? null;
}

// Every build a customer has started, newest first — backs the account dashboard.
export async function listBuildJobsForUser(userEmail: string): Promise<BuildJob[]> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      select * from app_build_jobs where user_email = ${userEmail} order by created_at desc
    `) as Array<Record<string, unknown>>;
    return rows.map(rowToJob);
  }
  return [...memory.values()]
    .filter((job) => job.userEmail === userEmail)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

// Deployed jobs (they have a URL) — the ops collector polls these apps' stats.
export async function listDeployedBuildJobs(limit = 100): Promise<BuildJob[]> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      select * from app_build_jobs where url is not null order by updated_at desc limit ${limit}
    `) as Array<Record<string, unknown>>;
    return rows.map(rowToJob);
  }
  return [...memory.values()]
    .filter((job) => Boolean(job.url))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, limit);
}

export async function updateBuildJob(id: string, patch: Partial<BuildJob>): Promise<void> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      update app_build_jobs set
        project_id = coalesce(${patch.projectId ?? null}, project_id),
        status = coalesce(${patch.status ?? null}, status),
        deployment_id = coalesce(${patch.deploymentId ?? null}, deployment_id),
        url = coalesce(${patch.url ?? null}, url),
        vercel_project = coalesce(${patch.vercelProject ?? null}, vercel_project),
        stats_token = coalesce(${patch.statsToken ?? null}, stats_token),
        error = ${patch.error ?? null},
        updated_at = now()
      where id = ${id}
    `;
    return;
  }
  const existing = memory.get(id);
  if (existing) memory.set(id, { ...existing, ...patch, updatedAt: new Date().toISOString() });
}
