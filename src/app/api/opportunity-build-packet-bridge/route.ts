import { NextResponse } from "next/server";
import {
  createOpportunityBuildPacketBridge,
  listOpportunityBuildPacketBridges
} from "@/lib/engine/opportunity-build-packet-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await listOpportunityBuildPacketBridges();

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
    const record = await createOpportunityBuildPacketBridge({
      candidateId: body?.candidateId
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
        message: caught instanceof Error ? caught.message : "The Opportunity build packet bridge could not be created."
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
