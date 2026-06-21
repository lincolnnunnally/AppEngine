import { NextResponse } from "next/server";
import { analyzeIdea, analyzeIdeaInput } from "@/lib/engine/planner";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = analyzeIdeaInput.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid app idea",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  // analyze is a planning helper only. It must not create, trigger, or prepare a
  // build. Building requires the canonical gate:
  // problem_intake_gate -> clarification -> prior_work_check (enforced in build-gate.ts).
  return NextResponse.json({
    ...analyzeIdea(parsed.data),
    planningOnly: true,
    note: "Planning helper only. No build is created or triggered here. Route a real build through problem_intake_gate -> clarification -> prior_work_check."
  });
}
