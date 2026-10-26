import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { sweepUsage } from "@/lib/engine/app-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron, daily (vercel.json): measure every live customer app against its
// standard allowance and tell owners who need a bigger plan. Vercel sends `Authorization: Bearer $CRON_SECRET`;
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
  const result = await sweepUsage();
  return NextResponse.json({ ok: true, ...result });
}
