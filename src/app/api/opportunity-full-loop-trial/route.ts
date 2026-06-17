import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  listOpportunityFullLoopTrials,
  runOpportunityFullLoopTrial
} from "@/lib/engine/opportunity-full-loop-trial";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await listOpportunityFullLoopTrials();

  return NextResponse.json(
    {
      ok: true,
      records,
      guardrails: opportunityFullLoopApiGuardrails()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const record = await runOpportunityFullLoopTrial();

    return NextResponse.json(
      {
        ok: true,
        record,
        guardrails: opportunityFullLoopApiGuardrails()
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "The Opportunity full-loop trial could not run."
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }
}

function opportunityFullLoopApiGuardrails() {
  return {
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    migrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true,
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true,
    finalPacketCreationBlocked: true
  };
}
