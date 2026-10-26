// Moves a build forward without anyone watching. A customer who pays and closes
// the tab must still end up with a live app and an email saying so — before
// this, a deploy was only marked live while someone's browser was polling
// /api/build/status. Used by that route and by the scheduled sweep
// (/api/cron/builds). SERVER ONLY.
import { getBuildJob, listBuildJobsByStatus, markBuildJobLive, updateBuildJob, type BuildJob } from "@/lib/engine/build-jobs";
import { listBuildingOrders } from "@/lib/engine/build-orders";
import { rebuildPaidOrder } from "@/lib/engine/customer-build";
import { getDeploymentState, verifyDeployedApp } from "@/lib/engine/vercel-deploy";
import { sendEmail } from "@/lib/solution-engine/notify";

function publicOrigin() {
  return (process.env.APP_ENGINE_PUBLIC_ORIGIN || "https://appengine.unitedundergod.org").replace(/\/$/, "");
}

export function appReadyEmail(job: Pick<BuildJob, "idea">, url: string) {
  const what = job.idea.trim().replace(/\s+/g, " ").slice(0, 120);
  return {
    subject: "Your app is up",
    body: [
      "Good news — the app you asked for is built and live:",
      "",
      url,
      "",
      `What you asked for: "${what}"`,
      "",
      "Open it and create your account with this same email address; that makes you its owner.",
      "Try it out. When you're happy, make it official from your apps page and it gets its main link:",
      `${publicOrigin()}/account`,
      "",
      "Something not right? Just reply to this email — a real person reads it.",
      "",
      "— App Engine"
    ].join("\n")
  };
}

export type AdvanceResult = { status: BuildJob["status"]; url: string | null; verified?: boolean; error?: string | null };

// One deploying job: if Vercel has finished, mark it live (and tell the owner,
// once) or failed. Anything else is left as it is.
export async function advanceBuildJob(job: BuildJob): Promise<AdvanceResult> {
  if (job.status !== "deploying" || !job.deploymentId) {
    return { status: job.status, url: job.url, error: job.error };
  }
  const state = await getDeploymentState(job.deploymentId);
  if (state.state === "READY") {
    const url = state.url || job.url;
    const verified = url ? await verifyDeployedApp(url) : false;
    const flipped = await markBuildJobLive(job.id, url);
    if (flipped && url) {
      const email = appReadyEmail(job, url.startsWith("http") ? url : `https://${url}`);
      const sent = await sendEmail({ to: job.userEmail, ...email });
      if (!sent.sent) console.error(`app-ready email for ${job.id} not sent: ${sent.reason}`);
    }
    return { status: "live", url, verified };
  }
  if (state.state === "ERROR" || state.state === "CANCELED") {
    const error = "The deployment failed while building.";
    await updateBuildJob(job.id, { status: "failed", error });
    return { status: "failed", url: job.url, error };
  }
  return { status: job.status, url: job.url, error: job.error };
}

// The scheduled sweep: finish deploys nobody is watching, and redo paid builds
// that failed (owner policy: redo, never charge again). Each step is
// idempotent, so overlapping sweeps or a sweep racing a poll are safe.
export async function sweepBuilds(): Promise<{ advanced: number; live: number; redone: number; runs: Array<() => Promise<void>> }> {
  let advanced = 0;
  let live = 0;
  for (const job of await listBuildJobsByStatus("deploying", 50)) {
    const result = await advanceBuildJob(job).catch(() => null);
    if (!result) continue;
    advanced += 1;
    if (result.status === "live") live += 1;
  }

  let redone = 0;
  const runs: Array<() => Promise<void>> = [];
  for (const order of await listBuildingOrders(50)) {
    if (!order.jobId) continue;
    const job = await getBuildJob(order.jobId);
    if (job && job.status !== "failed") continue;
    const redo = await rebuildPaidOrder(order.id).catch(() => null);
    if (redo && "run" in redo && redo.run) {
      redone += 1;
      runs.push(redo.run);
    }
  }
  return { advanced, live, redone, runs };
}
