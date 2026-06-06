import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isLocalMode } from "@/lib/engine/local-mode";
import { createPlannedProject, createProjectInput, listPlannedProjects } from "@/lib/engine/persistence";

export async function GET() {
  try {
    if (!isLocalMode() && !(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await listPlannedProjects());
  } catch (caught) {
    return getProjectRouteError(caught, "Project list failed");
  }
}

export async function POST(request: Request) {
  try {
    if (!isLocalMode() && !(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const parsed = createProjectInput.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid project",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const result = await createPlannedProject(parsed.data);

    return NextResponse.json(result, { status: 201 });
  } catch (caught) {
    return getProjectRouteError(caught, "Project save failed");
  }
}

function getProjectRouteError(caught: unknown, fallback: string) {
  const message = caught instanceof Error && caught.message ? caught.message : fallback;
  const setupHint =
    "Check /api/engine/health and /api/engine/setup-profile. On Vercel, project saving requires DATABASE_URL, APP_ENGINE_LOCAL_MODE=false, and the engine database schema/seeds applied.";

  return NextResponse.json(
    {
      error: message,
      hint: setupHint
    },
    { status: 500 }
  );
}
