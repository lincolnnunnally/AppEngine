import { NextResponse } from "next/server";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { createProblemIntakeRecord, listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  if (!(await canAccessEngineOwner())) {
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
