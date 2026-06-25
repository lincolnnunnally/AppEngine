import { NextResponse } from "next/server";
import { canAccessEngineConsumerSurface, canAccessEngineOwner } from "@/lib/auth/access";
import { createProblemIntakeRecord, listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";

export const dynamic = "force-dynamic";

// GET lists every submission — an operator view; stays owner-only so customers
// cannot enumerate other people's intakes.
export async function GET() {
  if (!(await canAccessEngineOwner())) {
    return unauthorized();
  }

  return NextResponse.json(
    {
      ok: true,
      records: await listProblemIntakeRecords()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

// POST is a customer action — submitting your own problem. Open to the staged
// consumer surface (default owner-only until Lincoln opens the doors).
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return intakeError("The intake could not be read. Please try again.");
  }

  try {
    const record = await createProblemIntakeRecord(payload as Record<string, unknown>);

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
    return intakeError(caught instanceof Error ? caught.message : "The intake could not be saved.");
  }
}

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      message: "Unauthorized"
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function intakeError(message: string) {
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
