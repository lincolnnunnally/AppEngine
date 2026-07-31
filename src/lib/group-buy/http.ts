// HTTP edges for Group Buy.
//
// Two audiences with different trust:
//
//   Public reads  — open campaigns and their progress. No PII, no auth, CORS-open
//                   so any ecosystem app can render a "join the group order" card.
//   Member writes — placing an order asserts "I am user X in app Y". That claim
//                   must be signed for, so writes require the calling app's token
//                   and are made server-side. A browser never holds one.

import { NextResponse } from "next/server";
import { GroupBuyDbError } from "./db";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400"
};

export function corsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GROUP_BUY_APP_TOKENS="knd:tok_abc,churchconnect:tok_def"
// Each satellite app gets its own token so one app can never place orders as
// another app's members, and a leak is revoked without touching the others.
function appTokenMap(env: NodeJS.ProcessEnv = process.env): Map<string, string> {
  const raw = (env.GROUP_BUY_APP_TOKENS || "").trim();
  const map = new Map<string, string>();

  if (!raw) {
    return map;
  }

  for (const entry of raw.split(",")) {
    const [app, token] = entry.split(":").map((part) => part.trim());

    if (app && token) {
      map.set(app, token);
    }
  }

  return map;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export type AppCaller = { appSlug: string };

// Returns the app the bearer token belongs to, or null. The caller's claimed
// app_slug is then checked against this — a token is scoped to exactly one app.
//
// gb_app_tokens is the source of truth (the shared edge function reads the same
// table), with GROUP_BUY_APP_TOKENS as a local-dev fallback so the flow can be
// exercised without touching production credentials.
export async function authenticateApp(request: Request): Promise<AppCaller | null> {
  const header = request.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!presented) {
    return null;
  }

  for (const [appSlug, token] of appTokenMap()) {
    if (timingSafeEqual(presented, token)) {
      return { appSlug };
    }
  }

  try {
    const { selectRows } = await import("./db");
    const rows = await selectRows<{ app_slug: string; token: string }>(
      "gb_app_tokens",
      "select=app_slug,token&active=is.true"
    );

    for (const row of rows) {
      if (timingSafeEqual(presented, row.token)) {
        return { appSlug: row.app_slug };
      }
    }
  } catch {
    // Storage unreachable — fall through to a plain 401 rather than leaking why.
  }

  return null;
}

export function groupBuyErrorResponse(error: unknown) {
  if (error instanceof GroupBuyDbError) {
    return corsJson({ ok: false, message: error.message, detail: error.detail }, error.status);
  }

  const message = error instanceof Error ? error.message : "Group Buy hit an unexpected error.";

  // Surface the database's own guard messages — they are written for humans and
  // say exactly which invariant was violated.
  const status = /threshold|not open|closed|exemption|ship_to/i.test(message) ? 409 : 500;

  return corsJson({ ok: false, message }, status);
}
