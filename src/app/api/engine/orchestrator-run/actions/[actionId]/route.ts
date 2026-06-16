import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  listOrchestratorActionQueue,
  updateOrchestratorActionStatus,
  type OrchestratorActionStatus
} from "@/lib/engine/orchestrator-run";
import { updateProjectMemoryFromOrchestratorAction } from "@/lib/engine/project-memory";

type ActionParams = {
  params: Promise<{
    actionId: string;
  }>;
};

const allowedStatuses: OrchestratorActionStatus[] = ["queued", "prepared_handoff", "owner_approved", "blocked", "completed"];

export async function POST(request: Request, { params }: ActionParams) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { actionId } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status;

    if (!status || !allowedStatuses.includes(status as OrchestratorActionStatus)) {
      return NextResponse.json({ error: "Unsupported action queue status." }, { status: 400 });
    }

    const actionQueueItem = await updateOrchestratorActionStatus(actionId, status as OrchestratorActionStatus);

    if (!actionQueueItem) {
      return NextResponse.json({ error: "Orchestrator action queue item not found." }, { status: 404 });
    }

    const projectMemory = await updateProjectMemoryFromOrchestratorAction(actionQueueItem);

    return NextResponse.json({
      actionQueueItem,
      actionQueue: await listOrchestratorActionQueue(),
      projectMemory,
      hint:
        "Action queue status updated locally/mock and Project Memory was updated. This endpoint does not trigger Codex, create GitHub issues, apply labels, deploy, migrate, create paid resources, change secrets/env, change repository visibility, or auto-merge."
    });
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Action queue update failed";

    return NextResponse.json(
      {
        error: message,
        hint:
          "Action queue updates are local/mock owner-control updates only. They do not trigger Codex, create GitHub issues, apply labels, deploy, migrate, create paid resources, change secrets/env, change repository visibility, or auto-merge."
      },
      { status: 500 }
    );
  }
}
