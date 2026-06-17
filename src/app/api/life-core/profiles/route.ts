import { NextResponse } from "next/server";
import { listLifeCoreProfiles } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      profiles: await listLifeCoreProfiles()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
