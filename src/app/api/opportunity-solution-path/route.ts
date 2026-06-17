import { NextResponse } from "next/server";
import {
  createOpportunitySolutionPath,
  listOpportunitySolutionPaths
} from "@/lib/engine/opportunity-solution-path";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      records: await listOpportunitySolutionPaths()
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
    return pathError("The solution path request could not be read. Please try again.");
  }

  try {
    const record = await createOpportunitySolutionPath(payload as Record<string, unknown>);

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
    return pathError(caught instanceof Error ? caught.message : "The solution path could not be saved.");
  }
}

function pathError(message: string) {
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
