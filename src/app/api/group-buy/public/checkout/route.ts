import { authenticateApp, corsJson, corsPreflight, groupBuyErrorResponse } from "@/lib/group-buy/http";
import { GroupBuyDbError, isGroupBuyConfigured, selectOne } from "@/lib/group-buy/db";
import { startOrderCheckout } from "@/lib/group-buy/connect";
import { getMemberOrder } from "@/lib/group-buy/service";
import type { Campaign, Vendor } from "@/lib/group-buy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeReturnUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// Member pays the pooled order. The calling app authenticates; the amount and
// the destination come from the server, never from the body.
export async function POST(request: Request) {
  if (!isGroupBuyConfigured()) {
    return corsJson({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const caller = await authenticateApp(request);

  if (!caller) {
    return corsJson({ ok: false, message: "A valid app token is required to start checkout." }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson({ ok: false, message: "Expected a JSON body." }, 400);
  }

  const campaignSlug = String(body.campaign || body.campaign_slug || "").trim();
  const externalUserId = String(body.user_id || body.external_user_id || "").trim();
  const successUrl = String(body.success_url || "").trim();
  const cancelUrl = String(body.cancel_url || "").trim();

  if (!campaignSlug || !externalUserId) {
    return corsJson({ ok: false, message: "campaign and user_id are both required." }, 400);
  }

  if (!successUrl || !cancelUrl || !isSafeReturnUrl(successUrl) || !isSafeReturnUrl(cancelUrl)) {
    return corsJson({ ok: false, message: "success_url and cancel_url must be http(s) URLs." }, 400);
  }

  try {
    const found = await getMemberOrder(campaignSlug, caller.appSlug, externalUserId);

    if (!found) {
      return corsJson({ ok: false, message: "No open order to pay for." }, 404);
    }

    if (found.order.payment_status === "paid") {
      return corsJson({ ok: true, already_paid: true, order_id: found.order.id });
    }

    const campaign = await selectOne<Campaign>("gb_campaigns", `select=*&id=eq.${found.order.campaign_id}`);

    if (!campaign) {
      throw new GroupBuyDbError("Campaign is missing.", 500);
    }

    const vendor = await selectOne<Vendor>("gb_vendors", `select=*&id=eq.${campaign.vendor_id}`);

    if (!vendor) {
      throw new GroupBuyDbError("Vendor is missing.", 500);
    }

    const checkout = await startOrderCheckout({
      order: found.order,
      campaign,
      vendor,
      successUrl,
      cancelUrl
    });

    return corsJson({
      ok: true,
      url: checkout.url,
      session_id: checkout.sessionId,
      amount_cents: checkout.amountCents,
      fee_cents: checkout.feeCents
    });
  } catch (error) {
    return groupBuyErrorResponse(error);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
