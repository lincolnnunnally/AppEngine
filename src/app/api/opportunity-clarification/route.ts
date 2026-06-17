import { NextResponse } from "next/server";
import {
  createOpportunityClarification,
  listOpportunityClarifications
} from "@/lib/engine/opportunity-clarification";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      records: await listOpportunityClarifications()
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
    return clarificationError("The clarification request could not be read. Please try again.");
  }

  try {
    const record = await createOpportunityClarification(payload as Record<string, unknown>);

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
    return clarificationError(caught instanceof Error ? caught.message : "The clarification could not be saved.");
  }
}

function clarificationError(message: string) {
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
