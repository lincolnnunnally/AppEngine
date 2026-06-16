import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadProjectMemory, updateProjectMemoryFromTrialReview } from "@/lib/engine/project-memory";
import { listTrialResultReviews, saveTrialResultReview } from "@/lib/engine/real-project-trial";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    reviews: await listTrialResultReviews(),
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
    const review = await saveTrialResultReview(
      {
        trialId: typeof body.trialId === "string" ? body.trialId : undefined,
        status: String(body.status || ""),
        note: typeof body.note === "string" ? body.note : ""
      },
      projectMemory
    );
    const updatedProjectMemory = await updateProjectMemoryFromTrialReview(review);

    return NextResponse.json({ review, projectMemory: updatedProjectMemory }, { status: 201 });
  } catch (caught) {
    return NextResponse.json(
      {
        error: caught instanceof Error ? caught.message : "Trial result review failed",
        hint:
          "Trial Result Review only stores local/mock owner feedback and never triggers Codex, GitHub issue creation, labels, deployments, migrations, paid resources, secrets/env changes, or auto-merge."
      },
      { status: 400 }
    );
  }
}
