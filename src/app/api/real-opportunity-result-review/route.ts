import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  createRealOpportunityResultReview,
  listRealOpportunityResultReviews
} from "@/lib/engine/real-opportunity-result-review";
import { updateProjectMemoryFromRealOpportunityResultReview } from "@/lib/engine/project-memory";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      records: await listRealOpportunityResultReviews(),
      guardrails: realOpportunityResultReviewApiGuardrails()
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
    const record = await createRealOpportunityResultReview(body);
    const projectMemory = await updateProjectMemoryFromRealOpportunityResultReview(record);

    return NextResponse.json(
      {
        ok: true,
        record,
        projectMemory,
        guardrails: realOpportunityResultReviewApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The real Opportunity result review could not be saved.",
        guardrails: realOpportunityResultReviewApiGuardrails()
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

function realOpportunityResultReviewApiGuardrails() {
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
