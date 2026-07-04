import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { pushVaultValueToVercel } from "@/lib/engine/ops-push-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Push one saved vault value into an app's Vercel project. STRICTLY owner-only —
// it writes a live production secret — and never a local-mode bypass. The owner
// initiates it per key; nothing here runs on its own.
export async function POST(request: Request) {
  if (!(await canAccessEngineOwner())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const session = await auth();
  const ownerEmail = normalizeUserKey(session?.user?.email);
  if (!ownerEmail) {
    return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
  }

  let body: { slug?: unknown; envVar?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const envVar = typeof body.envVar === "string" ? body.envVar : "";
  if (!slug || !envVar) {
    return NextResponse.json({ ok: false, message: "Which app and key?" }, { status: 400 });
  }

  const result = await pushVaultValueToVercel(ownerEmail, slug, envVar);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
