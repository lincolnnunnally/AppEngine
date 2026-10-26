import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildJob } from "@/lib/engine/build-jobs";
import { advanceBuildJob } from "@/lib/engine/build-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Poll a build's progress. While a deploy is in flight, checks the Vercel build
// and flips the job to "live" (with the URL) when it's READY. Owner-scoped.
export async function GET(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!userKey || !jobId) {
    return json({ ok: false, message: "Missing build id." }, 400);
  }

  const job = await getBuildJob(jobId);
  if (!job) {
    return json({ ok: false, message: "Build not found." }, 404);
  }
  if (job.userEmail !== userKey) {
    return json({ ok: false, message: "That isn't your build." }, 403);
  }

  // If the deploy is in flight, check whether Vercel has finished (shared with
  // the background sweep, which also emails the owner when it goes live).
  if (job.status === "deploying" && job.deploymentId) {
    const result = await advanceBuildJob(job);
    if (result.status !== "deploying") {
      return json({ ok: true, status: result.status, url: result.url, verified: result.verified, error: result.error, project: job.vercelProject });
    }
  }

  return json({ ok: true, status: job.status, url: job.url, error: job.error, project: job.vercelProject });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
