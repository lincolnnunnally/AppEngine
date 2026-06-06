import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isLocalMode } from "@/lib/engine/local-mode";
import { createPlannedProject, createProjectInput, listPlannedProjects } from "@/lib/engine/persistence";

export async function GET() {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await listPlannedProjects());
}

export async function POST(request: Request) {
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
}
