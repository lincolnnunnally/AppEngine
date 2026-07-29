// Shared plumbing for the Solution Engine's HTTP surface.
//
// The public routes are genuinely public — no signup wall is the whole first
// impression (§3, Land). That means the only things standing between this app and
// a bored script are the limits in this file, so they are deliberate rather than
// incidental.

import { NextResponse } from "next/server";
import { SolutionEngineDbError, isSolutionEngineConfigured } from "./db";
import { CaseTransitionError } from "./state-machine";

export const MAX_MESSAGE_CHARS = 4000;

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status, headers: { "Cache-Control": "no-store" } });
}

export function requireConfigured() {
  if (!isSolutionEngineConfigured()) {
    return jsonError("This isn't available right now. Try again in a few minutes.", 503);
  }

  return null;
}

export function handleCaught(caught: unknown) {
  if (caught instanceof CaseTransitionError) {
    return jsonError(caught.message, 409);
  }

  if (caught instanceof SolutionEngineDbError) {
    // Never leak storage detail to a public caller; it's in the server log.
    console.error("[solution-engine] storage error", caught.status, caught.detail);
    return jsonError("Something went wrong on our end. Nothing you typed was lost — try again.", 500);
  }

  console.error("[solution-engine] unexpected error", caught);
  return jsonError("Something went wrong on our end.", 500);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function cleanText(value: unknown, max = MAX_MESSAGE_CHARS): string {
  return String(value ?? "")
    // Strip control characters, but keep the newlines and tabs someone actually typed.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

// A small, honest throttle. Per-instance and therefore not a security boundary —
// it exists so one impatient tab or one dumb script can't spin up a thousand cases.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function throttle(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "anonymous";
}
