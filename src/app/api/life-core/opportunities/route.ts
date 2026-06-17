import { NextResponse } from "next/server";
import { listLifeCoreOpportunities } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      opportunities: await listLifeCoreOpportunities()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
