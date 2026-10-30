// Saved campaigns for the Campaign Builder. Self-creating table, in-memory
// fallback, same pattern as ecosystem-inbox. SERVER ONLY.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import type { CampaignBrief, CampaignKit } from "@/lib/engine/campaign-builder-core";

export type CampaignStatus = "draft" | "live" | "paused" | "done";

export const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "live", "paused", "done"];

export type SavedCampaign = {
  id: string;
  company: string;
  product: string;
  brief: CampaignBrief;
  kit: CampaignKit;
  status: CampaignStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && (CAMPAIGN_STATUSES as string[]).includes(value);
}

const memory = new Map<string, SavedCampaign>();

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS engine_campaigns (
          id text PRIMARY KEY,
          company text NOT NULL,
          product text NOT NULL,
          brief jsonb NOT NULL,
          kit jsonb NOT NULL,
          status text NOT NULL DEFAULT 'draft',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS engine_campaigns_created_idx ON engine_campaigns (created_at DESC)`;
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

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function rowToCampaign(row: Record<string, unknown>): SavedCampaign {
  return {
    id: String(row.id),
    company: String(row.company || ""),
    product: String(row.product || ""),
    brief: json<CampaignBrief>(row.brief),
    kit: json<CampaignKit>(row.kit),
    status: isCampaignStatus(row.status) ? row.status : "draft",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export async function createCampaign(brief: CampaignBrief, kit: CampaignKit): Promise<SavedCampaign> {
  const now = new Date().toISOString();
  const campaign: SavedCampaign = {
    id: `cmp_${crypto.randomBytes(10).toString("hex")}`,
    company: brief.company.slice(0, 120),
    product: brief.product.slice(0, 240),
    brief,
    kit,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      INSERT INTO engine_campaigns (id, company, product, brief, kit, status, created_at, updated_at)
      VALUES (
        ${campaign.id}, ${campaign.company}, ${campaign.product},
        ${JSON.stringify(brief)}::jsonb, ${JSON.stringify(kit)}::jsonb, 'draft', now(), now()
      )
    `;
  } else {
    memory.set(campaign.id, campaign);
  }
  return campaign;
}

export async function listCampaigns(limit = 50): Promise<SavedCampaign[]> {
  const capped = Math.min(200, Math.max(1, limit));
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = await sql`SELECT * FROM engine_campaigns ORDER BY created_at DESC LIMIT ${capped}`;
    return (rows as Array<Record<string, unknown>>).map(rowToCampaign);
  }
  return [...memory.values()]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, capped);
}

export async function getCampaign(id: string): Promise<SavedCampaign | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = await sql`SELECT * FROM engine_campaigns WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToCampaign(rows[0] as Record<string, unknown>) : null;
  }
  return memory.get(id) ?? null;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<SavedCampaign | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = await sql`
      UPDATE engine_campaigns SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING *
    `;
    return rows[0] ? rowToCampaign(rows[0] as Record<string, unknown>) : null;
  }
  const current = memory.get(id);
  if (!current) return null;
  const updated: SavedCampaign = { ...current, status, updatedAt: new Date().toISOString() };
  memory.set(id, updated);
  return updated;
}
