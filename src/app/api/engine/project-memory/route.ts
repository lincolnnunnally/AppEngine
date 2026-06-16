import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export async function GET() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      projectMemory: await loadProjectMemory(),
      storage: process.env.VERCEL === "1" ? "mock-memory" : "local"
    });
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Project memory failed";

    return NextResponse.json(
      {
        error: message,
        hint: "Project Memory only reads local/mock memory and never triggers Codex, GitHub issues, labels, deploys, migrations, paid resources, or auto-merge."
      },
      { status: 500 }
    );
  }
}
