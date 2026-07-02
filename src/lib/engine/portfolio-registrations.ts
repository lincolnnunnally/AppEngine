// Owner-registered apps: the "Add an app" button on the portfolio dashboard.
// Lets the owner bring ANY existing app (built anywhere — Emergent, Lovable,
// another builder, plain GitHub) into the one dashboard without waiting for an
// audit pass. Durable in the main database (self-creating table, same pattern
// as build jobs / env vault). SERVER ONLY.
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

export type OwnerRegisteredApp = {
  slug: string;
  name: string;
  liveUrl: string;
  repoUrl: string;
  builtWith: string;
  notes: string;
  appStatus: "live" | "in_progress" | "idea";
  createdAt: string | null;
};

function hasDatabase(): boolean {
  return Boolean(getConfiguredDatabaseUrl());
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "app"
  );
}

let ensured = false;
async function ensureTable() {
  if (ensured || !hasDatabase()) return;
  const sql = getDatabase();
  await sql`
    create table if not exists app_owner_registered_apps (
      slug text primary key,
      name text not null,
      live_url text not null default '',
      repo_url text not null default '',
      built_with text not null default '',
      notes text not null default '',
      app_status text not null default 'in_progress',
      created_at timestamptz not null default now()
    )
  `;
  ensured = true;
}

export async function listOwnerRegisteredApps(): Promise<OwnerRegisteredApp[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTable();
    const sql = getDatabase();
    const rows = await sql`select * from app_owner_registered_apps order by created_at desc limit 100`;
    return rows.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      liveUrl: String(row.live_url || ""),
      repoUrl: String(row.repo_url || ""),
      builtWith: String(row.built_with || ""),
      notes: String(row.notes || ""),
      appStatus: (["live", "in_progress", "idea"].includes(String(row.app_status)) ? String(row.app_status) : "in_progress") as OwnerRegisteredApp["appStatus"],
      createdAt: row.created_at ? String(row.created_at) : null
    }));
  } catch {
    return [];
  }
}

export async function registerOwnerApp(input: {
  name: string;
  liveUrl?: string;
  repoUrl?: string;
  builtWith?: string;
  notes?: string;
  appStatus?: string;
}): Promise<{ ok: boolean; message: string; slug?: string }> {
  if (!hasDatabase()) {
    return { ok: false, message: "Durable storage isn't configured in this environment." };
  }
  const name = (input.name || "").trim();
  if (name.length < 2) return { ok: false, message: "Give the app a name." };

  const cleanUrl = (value?: string) => {
    const trimmed = (value || "").trim();
    return /^https?:\/\//.test(trimmed) ? trimmed : "";
  };
  const appStatus = ["live", "in_progress", "idea"].includes(input.appStatus || "") ? (input.appStatus as string) : "in_progress";
  const slug = slugify(name);

  await ensureTable();
  const sql = getDatabase();
  await sql`
    insert into app_owner_registered_apps (slug, name, live_url, repo_url, built_with, notes, app_status)
    values (${slug}, ${name}, ${cleanUrl(input.liveUrl)}, ${cleanUrl(input.repoUrl)}, ${(input.builtWith || "").trim().slice(0, 120)}, ${(input.notes || "").trim().slice(0, 500)}, ${appStatus})
    on conflict (slug) do update set
      name = excluded.name,
      live_url = excluded.live_url,
      repo_url = excluded.repo_url,
      built_with = excluded.built_with,
      notes = excluded.notes,
      app_status = excluded.app_status
  `;
  return { ok: true, message: `${name} is on the dashboard.`, slug };
}
