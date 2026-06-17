import { NextResponse } from "next/server";
import { listLifeCoreFeedItems } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      feed: await listLifeCoreFeedItems()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
