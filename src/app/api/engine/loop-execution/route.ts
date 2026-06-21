import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  completeLoopRun,
  createLoopRunFromPacket,
  listLoopExecutionRecords,
  requireLoopRunForExecution
} from "@/lib/engine/loop-run-records";

export const dynamic = "force-dynamic";

// Canonical execution entrypoint. A loop_run_record is the single execution
// record; it can only be created from an approved candidate packet with a passed
// prior_work_check. Fail-closed: missing approvals are rejected.
export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return loopError("Owner access is required.", 403);
  }

  return NextResponse.json(
    { ok: true, records: await listLoopExecutionRecords() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return loopError("Owner access is required.", 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return loopError("The request could not be read. Please try again.");
  }

  const action = typeof payload.action === "string" ? payload.action : "create_from_packet";

  try {
    if (action === "create_from_packet") {
      const record = await createLoopRunFromPacket(payload);
      return NextResponse.json({ ok: true, record }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (action === "verify_ready") {
      // Execution gate: no execution without a canonical loop_run_record.
      const runId = typeof payload.runId === "string" ? payload.runId : "";
      const record = await requireLoopRunForExecution(runId);
      return NextResponse.json({ ok: true, executionAllowed: true, record }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "complete") {
      const runId = typeof payload.runId === "string" ? payload.runId : "";
      const record = await completeLoopRun(runId, payload);
      return NextResponse.json({ ok: true, record }, { headers: { "Cache-Control": "no-store" } });
    }

    return loopError(`Unsupported action: ${action}. Use create_from_packet, verify_ready, or complete.`);
  } catch (caught) {
    // Fail closed: any missing approval or missing record blocks execution.
    return loopError(caught instanceof Error ? caught.message : "The loop execution request could not be completed.");
  }
}

function loopError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}
