import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  createInboxTicket,
  isValidInboxEmail,
  listInboxTickets,
  updateInboxTicket,
  type InboxStatus
} from "@/lib/engine/ecosystem-inbox";
import { getAppOpsCatalogEntry } from "@/lib/engine/app-ops-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 6;
const recent = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function allowSubmit(key: string): boolean {
  const now = Date.now();
  const prior = (recent.get(key) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (prior.length >= RATE_LIMIT) {
    recent.set(key, prior);
    return false;
  }
  prior.push(now);
  recent.set(key, prior);
  return true;
}

function authorizedAppForward(request: Request): boolean {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const inbox = (process.env.APP_ENGINE_INBOX_TOKEN || "").trim();
  const stats = (process.env.APP_ENGINE_STATS_TOKEN || "").trim();
  return Boolean((inbox && token === inbox) || (stats && token === stats));
}

export async function GET(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "all") as InboxStatus | "all";
  const slug = url.searchParams.get("app") || "";
  const tickets = await listInboxTickets({
    status: status === "open" || status === "in_progress" || status === "resolved" || status === "all" ? status : "all",
    slug,
    limit: 100
  });
  return NextResponse.json({ ok: true, tickets });
}

export async function POST(request: Request) {
  const isOwner = await canAccessEngineAdmin();
  const isForward = authorizedAppForward(request);
  if (!isOwner && !isForward) {
    if (!allowSubmit(clientKey(request))) {
      return NextResponse.json({ ok: false, message: "Please wait a bit before sending another note." }, { status: 429 });
    }
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, message: "That request was empty." }, { status: 400 });
  }

  // Honeypot — bots fill hidden fields; humans never see this.
  if (typeof payload.company === "string" && payload.company.trim()) {
    return NextResponse.json({ ok: true, id: "ok" });
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const slug = typeof payload.app === "string" ? payload.app.trim().toLowerCase() : "unknown";
  const appName = typeof payload.appName === "string" ? payload.appName.trim() : "";
  const source = typeof payload.source === "string" ? payload.source.trim() : isForward ? "app_forward" : "help_form";

  if (subject.length < 4 || body.length < 8) {
    return NextResponse.json({ ok: false, message: "Tell us a little more so we can actually help." }, { status: 400 });
  }
  if (!isValidInboxEmail(email)) {
    return NextResponse.json({ ok: false, message: "We need a real email so we can get back to you." }, { status: 400 });
  }
  if (slug && slug !== "unknown" && slug !== "other" && !getAppOpsCatalogEntry(slug)) {
    // Unknown slugs are still accepted — a person may be on an app that is not
    // catalogued yet. We just keep the label honest.
  }

  const ticket = await createInboxTicket({
    appSlug: slug || "unknown",
    appName: appName || undefined,
    subject,
    body,
    contactName: name,
    contactEmail: email,
    source
  });

  return NextResponse.json({ ok: true, id: ticket.id });
}

export async function PATCH(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "Missing ticket." }, { status: 400 });
  const statusRaw = typeof payload?.status === "string" ? payload.status : "";
  const status: InboxStatus | undefined =
    statusRaw === "open" || statusRaw === "in_progress" || statusRaw === "resolved" ? statusRaw : undefined;
  const ownerNote = typeof payload?.ownerNote === "string" ? payload.ownerNote : undefined;
  const ticket = await updateInboxTicket(id, { status, ownerNote });
  if (!ticket) return NextResponse.json({ ok: false, message: "That ticket is gone." }, { status: 404 });
  return NextResponse.json({ ok: true, ticket });
}
