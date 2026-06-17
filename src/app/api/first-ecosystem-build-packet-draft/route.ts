import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  createFirstEcosystemBuildPacketDraft,
  firstEcosystemBuildPacketDraftGuardrails,
  listFirstEcosystemBuildPacketDrafts
} from "@/lib/engine/first-ecosystem-build-packet-draft";
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
      records: await listFirstEcosystemBuildPacketDrafts(),
      guardrails: firstEcosystemBuildPacketDraftApiGuardrails()
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
    const body = (await request.json().catch(() => ({}))) as { sourceBuildRequestId?: unknown };
    const record = await createFirstEcosystemBuildPacketDraft(body);

    return NextResponse.json(
      {
        ok: true,
        record,
        projectMemory: await loadProjectMemory(),
        portfolioRegistry: await loadOwnerPortfolioRegistry(),
        guardrails: firstEcosystemBuildPacketDraftApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The first ecosystem build packet draft could not be prepared.",
        guardrails: firstEcosystemBuildPacketDraftApiGuardrails()
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

function firstEcosystemBuildPacketDraftApiGuardrails() {
  return {
    ...firstEcosystemBuildPacketDraftGuardrails(),
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
