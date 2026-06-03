import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/auth/roles";
import { generateProjectApp, listGeneratedAppExports } from "@/lib/engine/app-generator";
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
    const message = caught instanceof Error ? caught.message : "App export failed";
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
