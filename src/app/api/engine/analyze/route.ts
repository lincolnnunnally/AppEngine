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

  return NextResponse.json(analyzeIdea(parsed.data));
}
