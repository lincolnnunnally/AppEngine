import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { deployAppBackend } from "@/lib/engine/app-backend-deploy";
import { verifyRenderHealth } from "@/lib/engine/render-client";
import { setCustomIntegrationValue } from "@/lib/engine/integrations-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stand up an app's Render backend from AppEngine. STRICTLY owner-only — it uses a
// full-account Render key and creates a live service. The key can come from the
// owner's vault/env or be pasted inline for this one deploy; when pasted, we also
// save it to We Succeed's env so the next deploy needs no paste (the vault's whole
// point — paste once, reused).
export async function POST(request: Request) {
  if (!(await canAccessEngineOwner())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const session = await auth();
  const ownerEmail = normalizeUserKey(session?.user?.email);
  if (!ownerEmail) {
    return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
  }

  let body: { slug?: unknown; apiKey?: unknown; save?: unknown; secrets?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json({ ok: false, message: "Which app?" }, { status: 400 });
  }
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined;

  // Owner-pasted backend secrets (service-role key, admin password, …) flow straight
  // to Render for this deploy and are NOT stored here — only the Render key is saved.
  const secretOverrides: Record<string, string> = {};
  if (body.secrets && typeof body.secrets === "object") {
    for (const [k, v] of Object.entries(body.secrets as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) secretOverrides[k] = v.trim();
    }
  }

  const result = await deployAppBackend(ownerEmail, slug, { apiKeyOverride: apiKey, secretOverrides });

  // If the owner pasted a key inline and the deploy got far enough to use it,
  // remember it for next time (unless they opted out). Best-effort — never blocks
  // or fails the deploy response.
  let keySaved: string | undefined;
  const reachedRender = result.ok || result.needsRepoConnect || result.missingSecrets !== undefined;
  if (apiKey && body.save !== false && reachedRender) {
    const saved = await setCustomIntegrationValue("RENDER_API_KEY", apiKey).catch(() => ({ ok: false }));
    keySaved = saved.ok ? "Saved your Render key for next time." : undefined;
  }

  return NextResponse.json({ ...result, keySaved }, { status: result.ok ? 200 : 400 });
}

// Poll whether a backend is actually answering — the real "it's live" signal (a
// build reporting READY isn't the same as the health path responding). No key
// needed; this just GETs the service's health URL server-side.
export async function GET(request: Request) {
  if (!(await canAccessEngineOwner())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, message: "Which URL?" }, { status: 400 });
  }
  const healthy = await verifyRenderHealth(url);
  return NextResponse.json({ ok: true, healthy });
}
