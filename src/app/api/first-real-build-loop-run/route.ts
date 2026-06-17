import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  firstRealBuildLoopRunGuardrails,
  intakeFirstRealBuildResult,
  listFirstRealBuildLoopRuns,
  runFirstRealBuildLoopRun
} from "@/lib/engine/first-real-build-loop-run";
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
      records: await listFirstRealBuildLoopRuns(),
      guardrails: firstRealBuildLoopRunApiGuardrails()
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
    const body = await request.json().catch(() => ({}));
    if (body?.action === "result") {
      const result = await intakeFirstRealBuildResult({
        runId: body.runId,
        resultText: body.resultText
      });

      return NextResponse.json(
        {
          ok: true,
          ...result,
          records: await listFirstRealBuildLoopRuns(),
          guardrails: firstRealBuildLoopRunApiGuardrails()
        },
        {
          headers: {
            "Cache-Control": "no-store"
          },
          status: 200
        }
      );
    }

    const record = await runFirstRealBuildLoopRun();

    return NextResponse.json(
      {
        ok: true,
        record,
        records: await listFirstRealBuildLoopRuns(),
        projectMemory: await loadProjectMemory(),
        portfolioRegistry: await loadOwnerPortfolioRegistry(),
        guardrails: firstRealBuildLoopRunApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The first real build loop run request could not be completed.",
        guardrails: firstRealBuildLoopRunApiGuardrails()
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

function firstRealBuildLoopRunApiGuardrails() {
  return {
    ...firstRealBuildLoopRunGuardrails(),
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    liveMigrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true,
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true
  };
}
