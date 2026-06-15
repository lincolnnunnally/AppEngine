import { NextResponse } from "next/server";
import { getStoryIntakeCapability, submitStoryIntake, type IntakePayload } from "@/lib/spark-of-hope-intake-lite/intake";

export async function POST(request: Request) {
  let payload: IntakePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        mode: getStoryIntakeCapability().mode,
        stored: false,
        message: "The story could not be read. Please try again."
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const result = await submitStoryIntake(payload);

  return NextResponse.json(
    result.body,
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function GET() {
  return NextResponse.json(
    getStoryIntakeCapability(),
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
