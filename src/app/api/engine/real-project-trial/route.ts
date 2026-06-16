import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listRealProjectTrials, listTrialProjectCandidates, saveRealProjectTrial } from "@/lib/engine/real-project-trial";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    candidates: listTrialProjectCandidates(),
    trials: await listRealProjectTrials(),
    storage: process.env.VERCEL === "1" ? "mock-memory" : "local"
  });
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const projectMemory = await loadProjectMemory();
    const trial = await saveRealProjectTrial(body, projectMemory);

    return NextResponse.json({ trial, projectMemory }, { status: 201 });
  } catch (caught) {
    return NextResponse.json(
      {
        error: caught instanceof Error ? caught.message : "Real project trial failed",
        hint:
          "The Real Project Trial Runner only stores local/mock summaries and never triggers Codex, GitHub issue creation, labels, deployments, migrations, paid resources, secrets/env changes, or auto-merge."
      },
      { status: 400 }
    );
  }
}
