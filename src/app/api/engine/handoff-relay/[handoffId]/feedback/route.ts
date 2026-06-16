import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { updateHandoffRelayFeedback, type HandoffFeedbackChoice } from "@/lib/engine/handoff-relay";

type FeedbackParams = {
  params: Promise<{
    handoffId: string;
  }>;
};

export async function POST(request: Request, { params }: FeedbackParams) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { handoffId } = await params;
    const payload = (await request.json()) as { choices?: unknown; note?: unknown };
    const choices = Array.isArray(payload.choices) ? payload.choices.map(String) : [];
    const note = typeof payload.note === "string" ? payload.note : "";
    const handoff = await updateHandoffRelayFeedback(handoffId, choices as HandoffFeedbackChoice[], note);

    return NextResponse.json({ handoff });
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Feedback save failed";

    return NextResponse.json(
      {
        error: message,
        hint: "Feedback is stored as a draft improvement candidate only. It does not trigger Codex or create GitHub work."
      },
      { status: 500 }
    );
  }
}
