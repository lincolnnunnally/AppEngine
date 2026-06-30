import { NextResponse } from "next/server";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { checkDomainAvailability } from "@/lib/engine/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Check a custom domain's availability + price for a signed-in customer. Read-only
// (no purchase). Uses Porkbun when configured, a price-table mock otherwise.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  let body: { domain?: unknown };
  try {
    body = (await request.json()) as { domain?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const domain = typeof body.domain === "string" ? body.domain : "";
  if (domain.trim().length < 3) {
    return json({ ok: false, message: "Enter a domain to check." }, 400);
  }

  const result = await checkDomainAvailability(domain);
  return json({ ok: true, ...result });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
