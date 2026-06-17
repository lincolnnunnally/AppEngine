import { NextResponse } from "next/server";
import {
  createOpportunityAppEngineCandidate,
  listOpportunityAppEngineCandidates
} from "@/lib/engine/opportunity-appengine-candidate";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await listOpportunityAppEngineCandidates();

  return NextResponse.json(
    {
      ok: true,
      records,
      guardrails: {
        productionDeployBlocked: true,
        paidResourcesBlocked: true,
        migrationsBlocked: true,
        secretsOrEnvChangesBlocked: true,
        repositoryVisibilityUnchanged: true,
        codexAutoExecutionBlocked: true,
        githubIssueCreationBlocked: true,
        labelChangesBlocked: true
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const record = await createOpportunityAppEngineCandidate({
      actionPlanId: body?.actionPlanId
    });

    return NextResponse.json(
      {
        ok: true,
        record
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
        message: caught instanceof Error ? caught.message : "The Opportunity AppEngine candidate could not be created."
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
