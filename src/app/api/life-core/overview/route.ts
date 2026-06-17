import { NextResponse } from "next/server";
import { getLifeCoreOverview } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      overview: await getLifeCoreOverview()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
