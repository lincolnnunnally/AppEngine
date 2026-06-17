import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { savePreparedHandoffFromReadyOpportunityResultReview } from "@/lib/engine/handoff-relay";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listRealOpportunityResultReviews } from "@/lib/engine/real-opportunity-result-review";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { reviewId?: unknown };
    const reviews = await listRealOpportunityResultReviews();
    const reviewId = typeof body.reviewId === "string" ? body.reviewId.trim() : "";
    const review = reviewId ? reviews.find((candidate) => candidate.id === reviewId) : reviews[0];

    if (!review) {
      return NextResponse.json(
        {
          ok: false,
          message: "Save a real Opportunity result review before preparing an AppEngine handoff.",
          guardrails: readyOpportunityHandoffApiGuardrails()
        },
        { status: 400 }
      );
    }

    if (review.reviewStatus !== "ready_for_next_appengine_action") {
      return NextResponse.json(
        {
          ok: false,
          message: "Only reviews marked ready_for_next_appengine_action can prepare an AppEngine action handoff.",
          reviewStatus: review.reviewStatus,
          guardrails: readyOpportunityHandoffApiGuardrails()
        },
        { status: 400 }
      );
    }

    const handoff = await savePreparedHandoffFromReadyOpportunityResultReview(review);

    return NextResponse.json(
      {
        ok: true,
        handoff,
        projectMemory: await loadProjectMemory(),
        portfolioRegistry: await loadOwnerPortfolioRegistry(),
        guardrails: readyOpportunityHandoffApiGuardrails()
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 201
      }
    );
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "The ready Opportunity handoff could not be prepared.",
        guardrails: readyOpportunityHandoffApiGuardrails()
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

function readyOpportunityHandoffApiGuardrails() {
  return {
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true,
    finalPacketCreationBlocked: true,
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    liveMigrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true
  };
}
