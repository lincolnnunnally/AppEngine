import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { sweepBuilds } from "@/lib/engine/build-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron, every 5 minutes (vercel.json): finish builds nobody is watching
// and redo failed paid builds. Vercel sends `Authorization: Bearer $CRON_SECRET`;
// without the secret configured, nothing runs.
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const a = crypto.createHash("sha256").update(header).digest();
  const b = crypto.createHash("sha256").update(`Bearer ${secret}`).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { advanced, live, redone, runs } = await sweepBuilds();
  for (const run of runs) after(run);
  return NextResponse.json({ ok: true, advanced, live, redone });
}
