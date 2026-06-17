import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  buildExecutionRequestGuardrails,
  createBuildExecutionRequest,
  intakeBuilderResult,
  listBuildExecutionHandoffSources,
  listBuildExecutionRequests,
  reviewBuildExecutionRequest
} from "@/lib/engine/build-execution-request";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      sources: await listBuildExecutionHandoffSources(),
      records: await listBuildExecutionRequests(),
      guardrails: buildExecutionRequestApiGuardrails()
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
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      sourceId?: unknown;
      requestId?: unknown;
      reviewStatus?: unknown;
      resultText?: unknown;
      note?: unknown;
    };
    const result =
      body.action === "review"
        ? {
            ...(await reviewBuildExecutionRequest(body)),
            builderResult: null
          }
        : body.action === "result"
          ? {
              ...(await intakeBuilderResult(body)),
              handoff: null,
              exportOutput: null
            }
        : {
            record: await createBuildExecutionRequest(body),
            builderResult: null,
            handoff: null,
            exportOutput: null
          };

    return NextResponse.json(
      {
        ok: true,
        record: result.record,
        builderResult: result.builderResult,
        handoff: result.handoff,
        exportOutput: result.exportOutput,
        records: await listBuildExecutionRequests(),
        sources: await listBuildExecutionHandoffSources(),
        projectMemory: await loadProjectMemory(),
        portfolioRegistry: await loadOwnerPortfolioRegistry(),
        guardrails: buildExecutionRequestApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The build execution request could not be created.",
        guardrails: buildExecutionRequestApiGuardrails()
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

function buildExecutionRequestApiGuardrails() {
  return {
    ...buildExecutionRequestGuardrails(),
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true,
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    liveMigrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true
  };
}
