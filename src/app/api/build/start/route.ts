import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineAdmin, canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { createBuildJob } from "@/lib/engine/build-jobs";
import { flatCheckoutEnabled } from "@/lib/engine/build-orders";
import { runCustomerBuildJob } from "@/lib/engine/customer-build";
import { estimateBuild } from "@/lib/engine/pricing/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full build (LLM agents + deploy kickoff) runs longer than a default request,
// so we use the function's allowed budget and run the work after responding.
export const maxDuration = 60;

// Kicks off a customer's build and returns a job id immediately. The heavy work
// (generate the real app -> deploy it live) runs in the background; the client
// polls /api/build/status for progress and the live URL.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  // With flat-rate checkout on (C3), a customer build is bought through
  // /api/build/checkout and started by the payment webhook — never here for free.
  // The platform owner can still build directly (testing, their own apps).
  if (flatCheckoutEnabled() && !(await canAccessEngineAdmin())) {
    return json({ ok: false, needsCheckout: true, message: "Pay for this build to start it." }, 402);
  }

  let body: {
    idea?: unknown;
    name?: unknown;
    themeId?: unknown;
    brand?: unknown;
    moduleSlugs?: unknown;
    featureIds?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const themeId = typeof body.themeId === "string" ? body.themeId.trim() : undefined;
  const rawBrand = body.brand && typeof body.brand === "object" ? (body.brand as Record<string, unknown>) : {};
  const brand = {
    accentColor: typeof rawBrand.accentColor === "string" ? rawBrand.accentColor : undefined,
    logoUrl: typeof rawBrand.logoUrl === "string" ? rawBrand.logoUrl : undefined
  };
  const featureIds = Array.isArray(body.featureIds)
    ? body.featureIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  let moduleSlugs = Array.isArray(body.moduleSlugs)
    ? body.moduleSlugs.filter((slug): slug is string => typeof slug === "string" && slug.trim().length > 0)
    : [];
  if (!moduleSlugs.length) {
    const estimate = estimateBuild({
      featureIds: featureIds.length ? featureIds : undefined,
      needText: idea
    });
    if (estimate.ok) moduleSlugs = estimate.moduleSlugs;
  }
  if (idea.length < 8) {
    return json({ ok: false, message: "Describe what you want built (a sentence or two)." }, 400);
  }

  const job = await createBuildJob(userKey, idea);
  after(async () => {
    await runCustomerBuildJob(job.id, userKey, idea, name, themeId, brand, moduleSlugs);
  });

  return json({ ok: true, jobId: job.id, status: "building" });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
