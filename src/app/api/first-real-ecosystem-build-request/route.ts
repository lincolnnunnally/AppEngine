import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  firstRealEcosystemBuildRequestGuardrails,
  firstRealEcosystemBuildRequestSeed,
  listFirstRealEcosystemBuildRequests,
  runFirstRealEcosystemBuildRequest
} from "@/lib/engine/first-real-ecosystem-build-request";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      seed: firstRealEcosystemBuildRequestSeed,
      records: await listFirstRealEcosystemBuildRequests(),
      guardrails: firstRealEcosystemBuildRequestApiGuardrails()
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
    const record = await runFirstRealEcosystemBuildRequest();

    return NextResponse.json(
      {
        ok: true,
        record,
        seed: firstRealEcosystemBuildRequestSeed,
        guardrails: firstRealEcosystemBuildRequestApiGuardrails()
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
        message: caught instanceof Error ? caught.message : "The first real ecosystem build request could not run.",
        guardrails: firstRealEcosystemBuildRequestApiGuardrails()
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

function firstRealEcosystemBuildRequestApiGuardrails() {
  return {
    ...firstRealEcosystemBuildRequestGuardrails(),
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
