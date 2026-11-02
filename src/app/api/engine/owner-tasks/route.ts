import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listOwnerTasks, submitOwnerTask, updateOwnerTask } from "@/lib/engine/owner-tasks";
import { normalizeTaskInput, OWNER_TASK_STATUSES, type OwnerTaskStatus } from "@/lib/engine/owner-tasks-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner to-do list API.
//   GET   — owner only. ?app=<slug>&all=1
//   POST  — owner, or an agent/app with a bearer token. Body: one task, or { tasks: [...] }.
//           Same id (or same app + title) re-posts update the wording, never reopen.
//   PATCH — owner: { id, status?, ownerNote? }. A token holder may only close a
//           task it verified as finished: { id, status: "done" }.
// Tokens: APP_ENGINE_TASKS_TOKEN, falling back to APP_ENGINE_INBOX_TOKEN.

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hasAgentToken(request: Request): boolean {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  return [process.env.APP_ENGINE_TASKS_TOKEN, process.env.APP_ENGINE_INBOX_TOKEN]
    .map((value) => (value || "").trim())
    .some((value) => value && safeEqual(token, value));
}

export async function GET(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const tasks = await listOwnerTasks({
    slug: url.searchParams.get("app") || "",
    includeClosed: url.searchParams.get("all") === "1"
  });
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(request: Request) {
  const isOwner = await canAccessEngineAdmin();
  if (!isOwner && !hasAgentToken(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, message: "That request was empty." }, { status: 400 });
  }
  const entries = Array.isArray(payload.tasks) ? payload.tasks.slice(0, 50) : [payload];
  const origin = isOwner && !hasAgentToken(request) ? "owner" : "api";
  const results: Array<{ id: string; created: boolean; notify?: string } | { error: string }> = [];
  for (const entry of entries) {
    const parsed = normalizeTaskInput(entry);
    if (!parsed.ok) {
      results.push({ error: parsed.message });
      continue;
    }
    const saved = await submitOwnerTask(parsed.task, origin);
    results.push({ id: saved.task.id, created: saved.created, notify: saved.notify || undefined });
  }
  const failed = results.filter((result) => "error" in result).length;
  return NextResponse.json(
    { ok: failed === 0, results },
    { status: failed === results.length ? 400 : 200 }
  );
}

export async function PATCH(request: Request) {
  const isOwner = await canAccessEngineAdmin();
  const isAgent = !isOwner && hasAgentToken(request);
  if (!isOwner && !isAgent) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "Missing task id." }, { status: 400 });
  const statusRaw = typeof payload?.status === "string" ? payload.status : "";
  const status = (OWNER_TASK_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as OwnerTaskStatus) : undefined;
  const ownerNote = typeof payload?.ownerNote === "string" ? payload.ownerNote : undefined;
  if (isAgent && (status !== "done" || ownerNote !== undefined)) {
    return NextResponse.json({ ok: false, message: "An agent may only mark a task done." }, { status: 403 });
  }
  const task = await updateOwnerTask(id, { status, ownerNote });
  if (!task) return NextResponse.json({ ok: false, message: "That task is gone." }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}
