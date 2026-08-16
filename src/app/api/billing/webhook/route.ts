import { NextResponse } from "next/server";
import { creditAccount } from "@/lib/engine/billing";
import { verifyStripeSignature } from "@/lib/engine/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe -> us, when a credit purchase completes. NOT auth-gated (Stripe is the
// caller); security is the signature check. Crediting is idempotent on the Stripe
// event id, so retries never double-credit.
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(raw, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return new NextResponse("invalid signature", { status: 400 });
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: { id?: string; payment_status?: string; client_reference_id?: string; metadata?: Record<string, string> } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  if (event.type === "checkout.session.completed" && event.id) {
    const object = event.data?.object || {};
    const metadata = object.metadata || {};

    if (metadata.stream === "group-buy") {
      try {
        const { markOrderPaidFromCheckout } = await import("@/lib/group-buy/connect");
        const sessionId = (object as { id?: string }).id;
        if (sessionId) {
          await markOrderPaidFromCheckout(sessionId);
        }
      } catch {
        return new NextResponse("group-buy update failed", { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    const userKey = object.client_reference_id || metadata.user_key;
    const creditCents = Number(metadata.credit_cents);

    if (object.payment_status === "paid" && userKey && Number.isFinite(creditCents) && creditCents > 0) {
      try {
        await creditAccount(String(userKey), creditCents, `stripe_evt:${event.id}`, "Stripe credit purchase");
      } catch {
        // Return 500 so Stripe retries; the unique reference keeps the retry safe.
        return new NextResponse("credit failed", { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
