import { NextResponse } from "next/server";
import { markOrderPaidFromCheckout } from "@/lib/group-buy/connect";
import { verifyStripeSignature } from "@/lib/engine/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe → us when a group-buy member finishes Checkout. Same signing secret as
// the desk billing webhook is fine if Lincoln points both URLs at one secret,
// or this route can have GROUP_BUY_STRIPE_WEBHOOK_SECRET of its own.
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.GROUP_BUY_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!verifyStripeSignature(raw, signature, secret)) {
    return new NextResponse("invalid signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string; metadata?: Record<string, string> } } };

  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    if (session?.metadata?.stream === "group-buy" && session.id) {
      try {
        await markOrderPaidFromCheckout(session.id);
      } catch {
        return new NextResponse("order update failed", { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
