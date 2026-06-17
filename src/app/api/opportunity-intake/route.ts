import { NextResponse } from "next/server";
import { createOpportunityIntakeRecord, listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";

export const dynamic = "force-dynamic";

export async function GET() {
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

export async function POST(request: Request) {
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
