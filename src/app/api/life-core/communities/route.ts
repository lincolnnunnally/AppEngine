import { NextResponse } from "next/server";
import { listLifeCoreCommunities } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const { organizations, communities } = await listLifeCoreCommunities();

  return NextResponse.json(
    {
      ok: true,
      organizations,
      communities
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
