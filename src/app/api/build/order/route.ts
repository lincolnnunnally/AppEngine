import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildOrder } from "@/lib/engine/build-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The order page polls this after Stripe sends the customer back: pending until
// the webhook confirms payment, then the build job id to follow on
// /api/build/status. Owner-scoped.
export async function GET(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }
  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  const id = new URL(request.url).searchParams.get("id");
  if (!userKey || !id) {
    return json({ ok: false, message: "Missing order id." }, 400);
  }

  const order = await getBuildOrder(id);
  if (!order) {
    return json({ ok: false, message: "Order not found." }, 404);
  }
  if (order.userEmail !== userKey) {
    return json({ ok: false, message: "That isn't your order." }, 403);
  }

  return json({
    ok: true,
    status: order.status,
    jobId: order.jobId,
    priceCents: order.priceCents,
    lines: order.lineLabels
  });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
