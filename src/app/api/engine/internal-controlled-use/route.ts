import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  loadInternalControlledUseRunbook,
  runInternalControlledUseStep,
  type InternalControlledUseStepId
} from "@/lib/engine/internal-controlled-use-runbook";

export async function GET() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await loadInternalControlledUseRunbook());
  } catch (caught) {
    return internalControlledUseError(caught, "Internal controlled-use runbook failed");
  }
}

export async function POST(request: Request) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { stepId?: unknown };
    const stepId = typeof payload.stepId === "string" ? payload.stepId : "";

    return NextResponse.json(await runInternalControlledUseStep(stepId as InternalControlledUseStepId), { status: 201 });
  } catch (caught) {
    return internalControlledUseError(caught, "Internal controlled-use step failed");
  }
}

function internalControlledUseError(caught: unknown, fallback: string) {
  const message = caught instanceof Error && caught.message ? caught.message : fallback;

  return NextResponse.json(
    {
      error: message,
      hint:
        "Internal controlled-use steps are owner-clicked only. They do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, apply live migrations, change secrets/env vars, change repository visibility, or auto-merge."
    },
    { status: 500 }
  );
}
