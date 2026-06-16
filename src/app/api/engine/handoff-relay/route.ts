import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listHandoffRelaySummaries, saveHandoffRelaySummary } from "@/lib/engine/handoff-relay";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export async function GET() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      handoffs: await listHandoffRelaySummaries(),
      projectMemory: await loadProjectMemory(),
      storage: process.env.VERCEL === "1" ? "mock-memory" : "local"
    });
  } catch (caught) {
    return relayError(caught, "Handoff inbox failed");
  }
}

export async function POST(request: Request) {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { rawText?: unknown };
    const rawText = typeof payload.rawText === "string" ? payload.rawText : "";
    const handoff = await saveHandoffRelaySummary(rawText);

    return NextResponse.json({ handoff, projectMemory: await loadProjectMemory() }, { status: 201 });
  } catch (caught) {
    return relayError(caught, "Handoff analysis failed");
  }
}

function relayError(caught: unknown, fallback: string) {
  const message = caught instanceof Error && caught.message ? caught.message : fallback;

  return NextResponse.json(
    {
      error: message,
      hint: "The Handoff Relay Reducer only stores local/mock handoffs and never triggers Codex, GitHub labels, issue creation, deploys, migrations, paid resources, or auto-merge."
    },
    { status: 500 }
  );
}
