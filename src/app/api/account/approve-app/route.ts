import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getBuildJob, updateBuildJob } from "@/lib/engine/build-jobs";
import { promoteDeploymentToProduction } from "@/lib/engine/vercel-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Make it official": promotes the customer's tested PREVIEW deployment to their
// app's main link. Only the app's owner can approve; the exact deployment they
// tested is what goes official — no rebuild in between.
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }
  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { jobId?: unknown };
  try {
    body = (await request.json()) as { jobId?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!jobId) return json({ ok: false, message: "Which app should go official?" }, 400);

  const job = await getBuildJob(jobId);
  if (!job || job.userEmail !== userKey) {
    return json({ ok: false, message: "We couldn't find that app on your account." }, 404);
  }
  if (job.status !== "live" || !job.deploymentId || !job.vercelProject) {
    return json({ ok: false, message: "This app isn't ready to approve yet — wait for it to finish publishing." }, 409);
  }

  const promoted = await promoteDeploymentToProduction(job.vercelProject, job.deploymentId);
  if (!promoted.ok) {
    return json({ ok: false, message: promoted.message }, 502);
  }

  // The app's main link is now the canonical project domain.
  await updateBuildJob(jobId, { url: promoted.productionUrl ?? null });
  return json({ ok: true, message: promoted.message, url: promoted.productionUrl });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
