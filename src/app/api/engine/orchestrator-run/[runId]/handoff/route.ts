import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { savePreparedHandoffFromOrchestratorRun } from "@/lib/engine/handoff-relay";
import { listOrchestratorRuns, markOrchestratorActionPreparedHandoff } from "@/lib/engine/orchestrator-run";
import { loadProjectMemory, updateProjectMemoryFromOrchestratorAction } from "@/lib/engine/project-memory";

type HandoffParams = {
  params: Promise<{
    runId: string;
  }>;
};

export async function POST(_request: Request, { params }: HandoffParams) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;
    const runs = await listOrchestratorRuns();
    const run = runs.find((candidate) => candidate.id === runId);

    if (!run) {
      return NextResponse.json({ error: "Orchestrator run not found." }, { status: 404 });
    }

    const handoff = await savePreparedHandoffFromOrchestratorRun(run);
    const queuedAction = await markOrchestratorActionPreparedHandoff(run.id);

    if (queuedAction) {
      await updateProjectMemoryFromOrchestratorAction(queuedAction);
    }

    return NextResponse.json(
      {
        handoff,
        actionQueueItem: queuedAction,
        projectMemory: await loadProjectMemory(),
        hint:
          "Prepared handoff saved to the Handoff Inbox for owner review. This endpoint does not send prompts, trigger Codex, create GitHub issues, apply labels, deploy, migrate, create paid resources, change secrets/env, change repository visibility, or auto-merge."
      },
      { status: 201 }
    );
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Prepared handoff failed";

    return NextResponse.json(
      {
        error: message,
        hint:
          "The Orchestrator to Handoff Bridge only prepares a copyable Handoff Inbox entry. It never triggers Codex, creates GitHub issues, applies labels, deploys, migrates, creates paid resources, changes secrets/env, changes repository visibility, or auto-merges."
      },
      { status: 500 }
    );
  }
}
