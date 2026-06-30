import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildJob, updateBuildJob } from "@/lib/engine/build-jobs";
import { getDeploymentState, verifyDeployedApp } from "@/lib/engine/vercel-deploy";

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

  // If the deploy is in flight, check the Vercel build state.
  if (job.status === "deploying" && job.deploymentId) {
    const state = await getDeploymentState(job.deploymentId);
    if (state.state === "READY") {
      const url = state.url || job.url;
      // Completion gate (AIPOS): record whether the URL actually serves, so "live"
      // is verified — not just "Vercel says READY". We don't block on it (avoids a
      // hang if the app is slow to warm), but we report it honestly.
      const verified = url ? await verifyDeployedApp(url) : false;
      await updateBuildJob(jobId, { status: "live", url });
      return json({ ok: true, status: "live", url, verified, project: job.vercelProject });
    }
    if (state.state === "ERROR" || state.state === "CANCELED") {
      await updateBuildJob(jobId, { status: "failed", error: "The deployment failed while building." });
      return json({ ok: true, status: "failed", error: "The deployment failed while building." });
    }
  }

  return json({ ok: true, status: job.status, url: job.url, error: job.error, project: job.vercelProject });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
