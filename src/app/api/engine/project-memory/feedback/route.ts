import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { addProjectMemoryFeedback, type ProjectMemoryFeedbackChoice } from "@/lib/engine/project-memory";

export async function POST(request: Request) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { choices?: unknown; note?: unknown; sourceHandoffId?: unknown };
    const choices = Array.isArray(payload.choices) ? payload.choices.map(String) : [];
    const note = typeof payload.note === "string" ? payload.note : "";
    const sourceHandoffId = typeof payload.sourceHandoffId === "string" ? payload.sourceHandoffId : null;
    const projectMemory = await addProjectMemoryFeedback({
      choices: choices as ProjectMemoryFeedbackChoice[],
      note,
      sourceHandoffId
    });

    return NextResponse.json({ projectMemory });
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Project memory feedback failed";

    return NextResponse.json(
      {
        error: message,
        hint: "Project Memory feedback is stored as local/mock memory only. It does not trigger Codex or create GitHub work."
      },
      { status: 500 }
    );
  }
}
