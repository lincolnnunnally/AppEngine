import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { getBillingConfig, isBillingEnabled, normalizeUserKey } from "@/lib/engine/billing";
import { stripeRequest } from "@/lib/engine/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Starts a Stripe Checkout to buy a credit pack. Customer-accessible (must be
// signed in). Dormant until billing is enabled + Stripe configured.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }
  if (!isBillingEnabled()) {
    return json({ ok: false, message: "Billing isn't enabled yet." }, 400);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { packCents?: unknown };
  try {
    body = (await request.json()) as { packCents?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const packCents = Number(body.packCents);
  const config = getBillingConfig();
  if (!config.packsCents.includes(packCents)) {
    return json({ ok: false, message: "Choose a valid credit pack." }, 400);
  }

  // Return the buyer to the host they started on (the app now serves on more
  // than one domain); AUTH_URL stays the fallback when headers are absent.
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.AUTH_URL?.replace(/\/$/, "") || "https://www.we-succeed.org";

  try {
    const checkout = await stripeRequest<{ url?: string }>("/v1/checkout/sessions", {
      mode: "payment",
      client_reference_id: userKey,
      success_url: `${origin}/account?credits=added`,
      cancel_url: `${origin}/account?credits=cancelled`,
      metadata: { user_key: userKey, credit_cents: packCents },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.currency,
            unit_amount: packCents,
            product_data: { name: `We Succeed credits ($${(packCents / 100).toFixed(2)})` }
          }
        }
      ]
    });

    if (!checkout.url) {
      return json({ ok: false, message: "Couldn't start checkout. Try again." }, 502);
    }
    return json({ ok: true, url: checkout.url });
  } catch (caught) {
    return json({ ok: false, message: caught instanceof Error ? caught.message : "Checkout failed." }, 502);
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
