import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import {
  createBuildOrder,
  flatCheckoutEnabled,
  flatCheckoutReadiness,
  priceBuildPack,
  setBuildOrderSession
} from "@/lib/engine/build-orders";
import { stripeRequest } from "@/lib/engine/stripe";
import { parseArrival } from "@/lib/ui/arrival";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flat-rate checkout (C3). GET tells the compose screen whether to show "Pay and
// build". POST prices the pack on the server, records the order, and opens a
// Stripe Checkout for exactly that price; the signed webhook starts the build.
export async function GET() {
  const readiness = flatCheckoutReadiness();
  return json({ ok: true, enabled: flatCheckoutEnabled(), ready: readiness.ok, message: readiness.message ?? null });
}

export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }
  const readiness = flatCheckoutReadiness();
  if (!readiness.ok) {
    return json({ ok: false, message: readiness.message }, flatCheckoutEnabled() ? 503 : 400);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { idea?: unknown; name?: unknown; themeId?: unknown; brand?: unknown; featureIds?: unknown; arrival?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (idea.length < 8) {
    return json({ ok: false, message: "Describe what you want built (a sentence or two)." }, 400);
  }
  const featureIds = Array.isArray(body.featureIds)
    ? body.featureIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const rawBrand = body.brand && typeof body.brand === "object" ? (body.brand as Record<string, unknown>) : {};
  const brand = {
    accentColor: typeof rawBrand.accentColor === "string" ? rawBrand.accentColor.slice(0, 32) : undefined,
    logoUrl: typeof rawBrand.logoUrl === "string" ? rawBrand.logoUrl.slice(0, 500) : undefined
  };

  // The price is computed here, never taken from the request.
  const pack = priceBuildPack(idea, featureIds);
  if ("error" in pack) {
    return json({ ok: false, message: pack.error }, 400);
  }

  const order = await createBuildOrder(
    userKey,
    {
      idea: idea.slice(0, 2000),
      name: typeof body.name === "string" ? body.name.trim().slice(0, 80) || undefined : undefined,
      themeId: typeof body.themeId === "string" ? body.themeId.trim().slice(0, 40) || undefined : undefined,
      brand,
      arrival: parseArrival(body.arrival as { from?: unknown; org?: unknown } | null)
    },
    pack
  );

  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.APP_ENGINE_PUBLIC_ORIGIN?.replace(/\/$/, "") || "https://appengine.unitedundergod.org";
  const metadata = {
    order_id: order.id,
    user_key: userKey,
    app_slug: "appengine",
    stream: "build-order",
    source: order.source || "appengine"
  };

  try {
    const checkout = await stripeRequest<{ id?: string; url?: string }>("/v1/checkout/sessions", {
      mode: "payment",
      client_reference_id: userKey,
      customer_email: userKey,
      success_url: `${origin}/build/order/${order.id}`,
      cancel_url: `${origin}/build/order/${order.id}?cancelled=1`,
      metadata,
      payment_intent_data: { metadata, statement_descriptor_suffix: "APP BUILD" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: order.priceCents,
            product_data: {
              name: "Your app — built and published",
              description: order.lineLabels.join(" · ").slice(0, 500) || "Core app + live website"
            }
          }
        }
      ]
    });

    if (!checkout.url || !checkout.id) {
      return json({ ok: false, message: "Couldn't start checkout. Try again." }, 502);
    }
    await setBuildOrderSession(order.id, checkout.id);
    return json({ ok: true, orderId: order.id, url: checkout.url });
  } catch (caught) {
    return json({ ok: false, message: caught instanceof Error ? caught.message : "Checkout failed." }, 502);
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
