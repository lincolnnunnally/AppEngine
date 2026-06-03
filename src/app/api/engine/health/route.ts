import { NextResponse } from "next/server";
import { getEngineHealth } from "@/lib/engine/execution";

export async function GET() {
  return NextResponse.json(await getEngineHealth());
}
