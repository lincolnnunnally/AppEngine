import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { deleteVaultVar, KNOWN_KEYS, listVaultEntries, setVaultVar, vaultAvailable } from "@/lib/engine/env-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in user's key vault. GET lists key NAMES + scopes (never values);
// POST stores/updates a value (write-only); DELETE removes one.
async function requireUser() {
  if (!(await canAccessEngineConsumerSurface())) return null;
  const session = await auth();
  return normalizeUserKey(session?.user?.email) || null;
}

export async function GET() {
  const userKey = await requireUser();
  if (!userKey) return json({ ok: false, message: "Please sign in first." }, 401);
  const entries = await listVaultEntries(userKey);
  return json({ ok: true, available: vaultAvailable(), entries, catalog: KNOWN_KEYS });
}

export async function POST(request: Request) {
  const userKey = await requireUser();
  if (!userKey) return json({ ok: false, message: "Please sign in first." }, 401);

  let body: { key?: unknown; value?: unknown; appScope?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const key = typeof body.key === "string" ? body.key : "";
  const value = typeof body.value === "string" ? body.value : "";
  const appScope = typeof body.appScope === "string" ? body.appScope : "";
  const result = await setVaultVar(userKey, key, value, appScope);
  if (!result.ok) return json({ ok: false, message: result.message || "Couldn't save that key." }, 400);
  return json({ ok: true, message: "Saved. Your next build or update will use it." });
}

export async function DELETE(request: Request) {
  const userKey = await requireUser();
  if (!userKey) return json({ ok: false, message: "Please sign in first." }, 401);

  let body: { key?: unknown; appScope?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const key = typeof body.key === "string" ? body.key : "";
  if (!key) return json({ ok: false, message: "Which key should be removed?" }, 400);
  await deleteVaultVar(userKey, key, typeof body.appScope === "string" ? body.appScope : "");
  return json({ ok: true, message: "Removed." });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
