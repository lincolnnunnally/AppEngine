import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { createProblemIntakeGateRecord, listProblemIntakeGateRecords } from "@/lib/engine/problem-intake-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return intakeError("Owner access is required.", 403);
  }

  return NextResponse.json(
    {
      ok: true,
      records: await listProblemIntakeGateRecords()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return intakeError("Owner access is required.", 403);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return intakeError("The intake request could not be read. Please try again.");
  }

  try {
    const record = await createProblemIntakeGateRecord(payload as Record<string, unknown>);

    return NextResponse.json(
      {
        ok: true,
        record
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (caught) {
    return intakeError(caught instanceof Error ? caught.message : "The intake packet could not be created.");
  }
}

function intakeError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      message
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
