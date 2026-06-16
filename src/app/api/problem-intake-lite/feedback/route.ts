import { NextResponse } from "next/server";
import { addOwnerFeedbackImprovementCandidate } from "@/lib/engine/problem-intake-lite";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return feedbackError("The feedback could not be read. Please try again.");
  }

  try {
    const record = await addOwnerFeedbackImprovementCandidate(payload as Record<string, unknown>);

    return NextResponse.json(
      {
        ok: true,
        record
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (caught) {
    return feedbackError(caught instanceof Error ? caught.message : "The feedback could not be saved.");
  }
}

function feedbackError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      message
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
