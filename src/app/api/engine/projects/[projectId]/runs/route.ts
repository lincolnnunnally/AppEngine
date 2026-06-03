import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getEngineHealth, listAutomationRuns, runProjectAutomation } from "@/lib/engine/execution";
import { isLocalMode } from "@/lib/engine/local-mode";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const unauthorized = await getUnauthorizedResponse();

  if (unauthorized) {
    return unauthorized;
  }

  const { projectId } = await context.params;

  return NextResponse.json(await listAutomationRuns(projectId));
}

export async function POST(_request: Request, context: RouteContext) {
  const unauthorized = await getUnauthorizedResponse();

  if (unauthorized) {
    return unauthorized;
  }

  const { projectId } = await context.params;
  const health = await getEngineHealth();

  if (!health.schemaReady) {
    return NextResponse.json(
      {
        error: "Engine schema is not ready",
        health
      },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json(await runProjectAutomation(projectId), { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Automation run failed";
    const status = message === "Project not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

async function getUnauthorizedResponse() {
  if (isLocalMode()) {
    return null;
  }

  const session = await auth();

  if (!canAccessAdmin(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
