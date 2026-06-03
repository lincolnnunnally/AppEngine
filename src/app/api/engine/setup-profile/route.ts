import { NextResponse } from "next/server";
import { getEngineSetupProfile } from "@/lib/engine/setup-profile";

export async function GET() {
  return NextResponse.json(await getEngineSetupProfile());
}
