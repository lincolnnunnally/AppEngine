import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { createBuildJob } from "@/lib/engine/build-jobs";
import { runCustomerBuildJob } from "@/lib/engine/customer-build";

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

  const job = await createBuildJob(userKey, idea);
  after(async () => {
    await runCustomerBuildJob(job.id, userKey, idea, name);
  });

  return json({ ok: true, jobId: job.id, status: "building" });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
