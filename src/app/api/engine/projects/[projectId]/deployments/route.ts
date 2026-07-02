import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isBuildGateError } from "@/lib/engine/build-gate";
import { getEngineHealth, listProjectDeployments, prepareProjectDeployment } from "@/lib/engine/execution";
import { isLocalMode } from "@/lib/engine/local-mode";
import { autoDeployPreviewEnabled, executePreviewAutoDeploy } from "@/lib/engine/preview-auto-deploy";

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

  return NextResponse.json(await listProjectDeployments(projectId));
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
    const prepared = await prepareProjectDeployment(projectId);

    // Autonomous preview execution (spec: autonomous-build-activation.md, Change 3).
    // Runs ONLY when prepare cleared every blocker AND the flag is on. Preview only —
    // production deployments always stay manual and owner-approved.
    const deploymentStatus = (prepared.deployment as { status?: string } | undefined)?.status;
    if (deploymentStatus === "deployment_ready" && autoDeployPreviewEnabled()) {
      const autoDeploy = await executePreviewAutoDeploy(projectId);
      return NextResponse.json({ ...prepared, autoDeploy }, { status: 201 });
    }

    return NextResponse.json(prepared, { status: 201 });
  } catch (caught) {
    if (isBuildGateError(caught)) {
      return NextResponse.json({ error: caught.message, code: caught.code, reroute: "problem_intake_gate" }, { status: 403 });
    }
    const message = caught instanceof Error ? caught.message : "Deployment preparation failed";
    const status = message === "Project not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

async function getUnauthorizedResponse() {
  if (isLocalMode()) {
    return null;
  }

  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
