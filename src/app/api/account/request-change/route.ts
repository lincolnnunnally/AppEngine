import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildJob } from "@/lib/engine/build-jobs";
import { createChangeRequest } from "@/lib/engine/change-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A signed-in customer files a change request against one of their own built apps.
// We record it durably for the owner to act on; this does not auto-rebuild.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { jobId?: unknown; message?: unknown };
  try {
    body = (await request.json()) as { jobId?: unknown; message?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!jobId) {
    return json({ ok: false, message: "Missing app id." }, 400);
  }
  if (message.length < 4) {
    return json({ ok: false, message: "Describe the change you'd like (a sentence is fine)." }, 400);
  }

  const job = await getBuildJob(jobId);
  if (!job) {
    return json({ ok: false, message: "App not found." }, 404);
  }
  if (job.userEmail !== userKey) {
    return json({ ok: false, message: "That isn't your app." }, 403);
  }

  await createChangeRequest({ jobId, projectId: job.projectId, userEmail: userKey, message });
  return json({ ok: true, message: "Got it — your change request is recorded." });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
