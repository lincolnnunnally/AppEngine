import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  listRealOpportunityExamples,
  runRealOpportunityExample
} from "@/lib/engine/real-opportunity-example-runner";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      records: await listRealOpportunityExamples(),
      guardrails: realOpportunityExampleApiGuardrails()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const record = await runRealOpportunityExample(body);

    return NextResponse.json(
      {
        ok: true,
        record,
        guardrails: realOpportunityExampleApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The real Opportunity example could not run."
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

function realOpportunityExampleApiGuardrails() {
  return {
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    liveMigrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true,
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true,
    finalPacketCreationBlocked: true
  };
}
