import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isLocalMode } from "@/lib/engine/local-mode";
import { registerOwnerApp } from "@/lib/engine/portfolio-registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Add an app" on the owner portfolio dashboard: registers an existing app
// (built anywhere) so it is managed in the one dashboard. Owner/admin only.
export async function POST(request: Request) {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const result = await registerOwnerApp({
    name: text("name"),
    liveUrl: text("liveUrl"),
    repoUrl: text("repoUrl"),
    builtWith: text("builtWith"),
    notes: text("notes"),
    appStatus: text("appStatus")
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
