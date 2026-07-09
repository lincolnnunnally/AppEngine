import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineConsumerSurface, canAccessEngineOwner } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { importVaultEntries, isEngineRuntimeKey, parseBulkEnvContent } from "@/lib/engine/env-vault";
import { appEngineProjectId, setProjectEnvValue } from "@/lib/engine/integrations-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bulk key import: the whole uploaded/pasted file comes in as text and every
// usable KEY=VALUE / KEY,VALUE row is stored in the caller's vault. Values are
// never echoed back — the response is counts + skip reasons only.
const MAX_CONTENT_BYTES = 256 * 1024;

export async function POST(request: Request) {
  if (!(await canAccessEngineConsumerSurface())) {
    return json({ ok: false, message: "Please sign in first." }, 401);
  }
  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);
  if (!userKey) {
    return json({ ok: false, message: "We couldn't find your account email." }, 400);
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) {
    return json({ ok: false, message: "The file or pasted text was empty." }, 400);
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return json({ ok: false, message: "That file is too large — keys only, please (under 256KB)." }, 413);
  }

  const result = await importVaultEntries(userKey, content);
  if (!result.ok) {
    return json({ ok: false, message: result.message || "Nothing could be imported.", skipped: result.skipped }, 400);
  }

  // Owner bridge (same as the single-key route): any imported universal key the
  // engine itself reads is also mirrored into We Succeed's hosting env, so a bulk
  // import behaves exactly like typing each key in by hand. Best-effort.
  let mirrored = 0;
  if (await canAccessEngineOwner()) {
    const engineEntries = parseBulkEnvContent(content).entries.filter(
      (entry) => !entry.appScope && isEngineRuntimeKey(entry.key)
    );
    for (const entry of engineEntries) {
      const mirror = await setProjectEnvValue(appEngineProjectId() || "", entry.key, entry.value, { secret: true, label: entry.key });
      if (mirror.ok) mirrored += 1;
    }
  }

  const skippedNote = result.skipped.length ? ` ${result.skipped.length} line${result.skipped.length === 1 ? "" : "s"} skipped.` : "";
  const mirrorNote = mirrored ? ` ${mirrored} engine key${mirrored === 1 ? "" : "s"} also applied to the engine (live after its next redeploy).` : "";
  return json({
    ok: true,
    saved: result.saved,
    skipped: result.skipped,
    message: `Imported ${result.saved} key${result.saved === 1 ? "" : "s"}.${skippedNote}${mirrorNote}`
  });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
