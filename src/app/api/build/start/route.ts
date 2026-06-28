import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { BuildAffordabilityError, CustomerBuildUnavailableError, startCustomerBuild } from "@/lib/engine/customer-build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A signed-in customer triggers a build of their described idea. Today this runs
// the real generation pipeline in local/dev mode; on production it returns a
// clear "not enabled yet" until the customer-projects migration is applied.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { idea?: unknown; name?: unknown };
  try {
    body = (await request.json()) as { idea?: unknown; name?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (idea.length < 8) {
    return json({ ok: false, message: "Describe what you want built (a sentence or two)." }, 400);
  }

  try {
    const result = await startCustomerBuild(userKey, idea, name);
    return json({ ok: true, projectId: result.projectId, charge: result.charge });
  } catch (caught) {
    if (caught instanceof CustomerBuildUnavailableError) {
      return json({ ok: false, message: caught.message, code: caught.code }, 503);
    }
    if (caught instanceof BuildAffordabilityError) {
      return json({ ok: false, message: caught.message, code: caught.code }, 402);
    }
    return json({ ok: false, message: caught instanceof Error ? caught.message : "Build failed." }, 500);
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
