import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineAdmin, canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildJob } from "@/lib/engine/build-jobs";
import { getBuildOrder } from "@/lib/engine/build-orders";
import { rebuildPaidOrder } from "@/lib/engine/customer-build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A redo started from here runs after the response, like /api/build/start.
export const maxDuration = 60;

// The order page polls this after Stripe sends the customer back: pending until
// the webhook confirms payment, then the build job to follow on
// /api/build/status. If that build failed, checking the order redoes it
// (owner policy: a failed paid build is redone, never charged again) until the
// automatic attempts run out — then it waits on the owner. Owner-scoped; the
// platform owner may read any order.
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
  const isOwner = await canAccessEngineAdmin();
  if (order.userEmail !== userKey && !isOwner) {
    return json({ ok: false, message: "That isn't your order." }, 403);
  }

  let status: string = order.status;
  let jobId = order.jobId;
  if (order.status === "building" && jobId) {
    const job = await getBuildJob(jobId);
    if (!job || job.status === "failed") {
      const redo = await rebuildPaidOrder(order.id);
      if (redo && "exhausted" in redo) {
        status = "build_failed";
      } else if (redo) {
        jobId = redo.jobId;
        if (redo.run) after(redo.run);
      }
    }
  }

  return json({ ok: true, status, jobId, priceCents: order.priceCents, lines: order.lineLabels, canRebuild: isOwner && status === "build_failed" });
}

// Owner: rebuild a paid order whose automatic attempts are used up.
export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return json({ ok: false, message: "Only the platform owner can rebuild an order." }, 403);
  }
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const redo = id ? await rebuildPaidOrder(id, { byOwner: true }) : null;
  if (!redo || "exhausted" in redo) {
    return json({ ok: false, message: "This order can't be rebuilt right now." }, 400);
  }
  if (redo.run) after(redo.run);
  return json({ ok: true, jobId: redo.jobId });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
