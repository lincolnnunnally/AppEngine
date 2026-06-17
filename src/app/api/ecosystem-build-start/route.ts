import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import {
  appEngineUsageGuide,
  ecosystemBuildStartGuardrails,
  ecosystemBuildTargets,
  listEcosystemBuildStartRecords,
  startEcosystemBuild
} from "@/lib/engine/appengine-usage-guide-ecosystem-start";
import { listBuildExecutionRequests } from "@/lib/engine/build-execution-request";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      guide: appEngineUsageGuide(),
      targets: ecosystemBuildTargets(),
      records: await listEcosystemBuildStartRecords(),
      guardrails: ecosystemBuildStartApiGuardrails()
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
    const result = await startEcosystemBuild(body);

    return NextResponse.json(
      {
        ok: true,
        ...result,
        guide: appEngineUsageGuide(),
        targets: ecosystemBuildTargets(),
        records: await listEcosystemBuildStartRecords(),
        handoffs: await listHandoffRelaySummaries(),
        buildExecutionRequests: await listBuildExecutionRequests(),
        projectMemory: await loadProjectMemory(),
        portfolioRegistry: await loadOwnerPortfolioRegistry(),
        guardrails: ecosystemBuildStartApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The ecosystem build could not be started.",
        guardrails: ecosystemBuildStartApiGuardrails()
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

function ecosystemBuildStartApiGuardrails() {
  return {
    ...ecosystemBuildStartGuardrails(),
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
