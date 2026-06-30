import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { purchaseDomainForCustomer, quoteDomain } from "@/lib/engine/domain-purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Buy a custom domain (paid, from the customer's credits + margin). Two-step:
// POST without confirm -> returns the quote (price to confirm); POST with
// confirm:true -> charges credits + registers + attaches. Never buys without confirm.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { domain?: unknown; projectName?: unknown; confirm?: unknown };
  try {
    body = (await request.json()) as { domain?: unknown; projectName?: unknown; confirm?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  const confirm = body.confirm === true;
  if (domain.length < 3) {
    return json({ ok: false, message: "Enter a domain to buy." }, 400);
  }

  // Step 1: no confirm -> return the quote (price), so the customer can confirm.
  if (!confirm) {
    const quote = await quoteDomain(domain);
    if (!quote.available) {
      return json({ ok: true, available: false, domain: quote.domain });
    }
    return json({ ok: true, available: true, domain: quote.domain, priceUsd: quote.chargeCents / 100, needsConfirm: true });
  }

  // Step 2: confirmed -> purchase.
  if (!projectName) {
    return json({ ok: false, message: "Missing the app to attach the domain to." }, 400);
  }
  const result = await purchaseDomainForCustomer(userKey, domain, projectName, true);
  return json({ ok: result.ok, message: result.message, domain: result.domain }, result.ok ? 200 : 402);
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
