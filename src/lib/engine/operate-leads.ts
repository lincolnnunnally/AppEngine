// Local Leads for the owner cockpit. Operate keeps leads on its own database
// (Neon), not the shared LPL Supabase, so the cockpit asks Operate:
// GET /api/admin/lead-stats with a two-minute owner pass signed by the admin
// door's secret (APPENGINE_OPERATE_HANDOFF_SECRET). Counts and money only.
// SERVER ONLY.
import { adminDoorOrigin, mintHs256Jwt } from "@/lib/engine/admin-door-handoff";
import { leadStatsPassClaims, parseLeadStats, type OperateLeadStats } from "@/lib/engine/operate-leads-core";

export type OperateLeadsReport =
  | { state: "ok"; stats: OperateLeadStats }
  | { state: "not_connected"; reason: string }
  | { state: "error"; message: string };

export async function loadOperateLeads(
  ownerEmail: string | null,
  env: Record<string, string | undefined> = process.env
): Promise<OperateLeadsReport> {
  const secret = (env.APPENGINE_OPERATE_HANDOFF_SECRET || "").trim();
  if (!secret) return { state: "not_connected", reason: "APPENGINE_OPERATE_HANDOFF_SECRET is not set on this desk." };
  if (!ownerEmail) return { state: "not_connected", reason: "Sign in as the owner to read Operate." };
  const origin = adminDoorOrigin("operate");
  if (!origin) return { state: "not_connected", reason: "Operate's address is not recorded." };
  const now = Math.floor(Date.now() / 1000);
  const pass = mintHs256Jwt(leadStatsPassClaims(ownerEmail, now, crypto.randomUUID()), secret);
  try {
    const response = await fetch(`${origin}/api/admin/lead-stats`, {
      headers: { authorization: `Bearer ${pass}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    if (response.status === 404) {
      return { state: "error", message: "Operate did not accept this desk's pass (or lead stats are not deployed yet)." };
    }
    if (!response.ok) return { state: "error", message: `Operate answered ${response.status}.` };
    const stats = parseLeadStats(await response.json());
    return stats ? { state: "ok", stats } : { state: "error", message: "Operate's answer was not readable." };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "Operate could not be reached." };
  }
}
