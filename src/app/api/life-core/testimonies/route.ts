import { NextResponse } from "next/server";
import { listLifeCoreTestimonies } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      testimonies: await listLifeCoreTestimonies()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
