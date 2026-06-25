import { NextResponse } from "next/server";
import { canAccessEngineConsumerSurface, canAccessEngineOwner } from "@/lib/auth/access";
import { createOpportunityIntakeRecord, listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";

export const dynamic = "force-dynamic";

// GET lists every submission — an operator view; stays owner-only so customers
// cannot enumerate other people's opportunities.
export async function GET() {
  if (!(await canAccessEngineOwner())) {
    return unauthorized();
  }

  return NextResponse.json(
    {
      ok: true,
      records: await listOpportunityIntakeRecords()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

// POST is a customer action — submitting your own idea. Open to the staged
// consumer surface (default owner-only until Lincoln opens the doors).
export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return opportunityError("The opportunity could not be read. Please try again.");
  }

  try {
    const record = await createOpportunityIntakeRecord(payload as Record<string, unknown>);

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
    return opportunityError(caught instanceof Error ? caught.message : "The opportunity could not be saved.");
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

function opportunityError(message: string) {
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
