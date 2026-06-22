import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { generateProjectApp, listGeneratedAppExports } from "@/lib/engine/app-generator";
import { isBuildGateError } from "@/lib/engine/build-gate";
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

  return NextResponse.json(await listGeneratedAppExports(projectId));
}

export async function POST(_request: Request, context: RouteContext) {
  const unauthorized = await getUnauthorizedResponse();

  if (unauthorized) {
    return unauthorized;
  }

  const { projectId } = await context.params;

  try {
    return NextResponse.json(await generateProjectApp(projectId), { status: 201 });
  } catch (caught) {
    if (isBuildGateError(caught)) {
      return NextResponse.json({ error: caught.message, code: caught.code, reroute: "problem_intake_gate" }, { status: 403 });
    }
    const message = caught instanceof Error ? caught.message : "App export failed";
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
