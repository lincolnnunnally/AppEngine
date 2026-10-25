import { after, NextResponse } from "next/server";
import { creditAccount } from "@/lib/engine/billing";
import { markBuildOrderPaid } from "@/lib/engine/build-orders";
import { startPaidOrderBuild } from "@/lib/engine/customer-build";
import { verifyStripeSignature } from "@/lib/engine/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A paid flat-rate order starts its build from here (after responding), so the
// build gets the same budget /api/build/start gives it.
export const maxDuration = 60;

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
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        client_reference_id?: string;
        amount_total?: number;
        payment_intent?: string | null;
        metadata?: Record<string, string>;
      };
    };
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

    // Flat-rate build order (C3): paid once, at the price fixed when the order
    // was created. Stripe's amount must match; then the build starts here, so it
    // doesn't depend on the customer's browser coming back from Checkout.
    if (metadata.stream === "build-order") {
      if (object.payment_status !== "paid" || !metadata.order_id || !object.id) {
        return NextResponse.json({ received: true });
      }
      try {
        const paid = await markBuildOrderPaid({
          orderId: metadata.order_id,
          sessionId: object.id,
          amountCents: Number(object.amount_total),
          paymentIntent: object.payment_intent ?? null
        });
        if (!paid.ok) {
          // Money arrived that doesn't match an order we can build — never build
          // a different pack than was paid for. 200 so Stripe stops retrying; the
          // owner sees the payment in Stripe and the order stays unpaid here.
          console.error(`build-order ${metadata.order_id} not marked paid: ${paid.reason}`);
          return NextResponse.json({ received: true, built: false, reason: paid.reason });
        }
        const started = await startPaidOrderBuild(paid.order.id);
        if (started?.run) after(started.run);
        return NextResponse.json({ received: true, jobId: started?.jobId ?? null });
      } catch {
        // 500 so Stripe retries; paid/claimed are idempotent, so a retry is safe.
        return new NextResponse("build-order update failed", { status: 500 });
      }
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
