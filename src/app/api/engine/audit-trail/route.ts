import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadAuditTrailOwnerVisibilityReport } from "@/lib/engine/audit-trail-owner-visibility";

export async function GET() {
  try {
    if (!(await canAccessEngineAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await loadAuditTrailOwnerVisibilityReport();

    return NextResponse.json({
      report,
      storage: process.env.VERCEL === "1" ? "mock-memory" : "local_mock_jsonl"
    });
  } catch (caught) {
    const message = caught instanceof Error && caught.message ? caught.message : "Audit trail owner visibility failed";

    return NextResponse.json(
      {
        error: message,
        hint:
          "Audit Trail Owner Visibility only reads filtered local/mock audit events. It never triggers Codex, creates GitHub issues, applies labels, deploys, migrates, creates paid resources, changes secrets/env, changes repository visibility, or auto-merges."
      },
      { status: 500 }
    );
  }
}
