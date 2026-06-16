import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { listOrchestratorActionQueue, listOrchestratorRuns, saveOrchestratorRun } from "@/lib/engine/orchestrator-run";
import { loadProjectMemory, updateProjectMemoryFromOrchestratorRun } from "@/lib/engine/project-memory";
import { listRealProjectTrials } from "@/lib/engine/real-project-trial";

export async function GET() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      runs: await listOrchestratorRuns(),
      actionQueue: await listOrchestratorActionQueue(),
      storage: process.env.VERCEL === "1" ? "mock-memory" : "local"
    });
  } catch (caught) {
    return orchestratorError(caught, "Orchestrator history failed");
  }
}

export async function POST() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [projectMemory, handoffs, trials] = await Promise.all([loadProjectMemory(), listHandoffRelaySummaries(), listRealProjectTrials()]);
    const run = await saveOrchestratorRun({ projectMemory, handoffs, trials });
    const updatedProjectMemory = await updateProjectMemoryFromOrchestratorRun(run);

    return NextResponse.json(
      {
        run,
        actionQueue: await listOrchestratorActionQueue(),
        projectMemory: updatedProjectMemory
      },
      { status: 201 }
    );
  } catch (caught) {
    return orchestratorError(caught, "Manual orchestrator run failed");
  }
}

function orchestratorError(caught: unknown, fallback: string) {
  const message = caught instanceof Error && caught.message ? caught.message : fallback;

  return NextResponse.json(
    {
      error: message,
      hint:
        "Manual Orchestrator only reads local/mock state, stores an orchestrator_run artifact, updates Project Memory, and drafts a prompt. It never triggers Codex, creates GitHub issues, applies labels, deploys, migrates, creates paid resources, changes secrets/env, changes repository visibility, or auto-merges."
    },
    { status: 500 }
  );
}
