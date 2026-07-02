import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl, isLocalMode } from "@/lib/engine/local-mode";
import { promoteDeploymentToProduction } from "@/lib/engine/vercel-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

// Owner approval for the autonomous pipeline: promotes the project's most recent
// auto-deployed PREVIEW to production. The owner's click IS the production
// approval the release gate requires — nothing promotes without it.
export async function POST(_request: Request, context: RouteContext) {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getConfiguredDatabaseUrl()) {
    return NextResponse.json({ error: "Persistence isn't configured — approve from the production cockpit." }, { status: 503 });
  }

  const { projectId } = await context.params;
  const sql = getDatabase();
  const [preview] = await sql`
    select id, metadata from deployments
    where project_id = ${projectId} and environment = 'preview' and status = 'deployed_preview'
    order by created_at desc
    limit 1
  `;

  const metadata = (preview?.metadata ?? {}) as { deploymentId?: string; projectName?: string };
  if (!preview || !metadata.deploymentId || !metadata.projectName) {
    return NextResponse.json({ error: "No tested preview deployment found to promote." }, { status: 409 });
  }

  const promoted = await promoteDeploymentToProduction(metadata.projectName, metadata.deploymentId);
  if (!promoted.ok) {
    return NextResponse.json({ error: promoted.message }, { status: 502 });
  }

  await sql`
    insert into deployments (project_id, provider, environment, status, url, metadata, verified_at)
    values (${projectId}, 'vercel', 'production', 'deployed_production', ${promoted.productionUrl || null},
      ${JSON.stringify({ promotedFrom: metadata.deploymentId, projectName: metadata.projectName, ownerApproved: true })}, now())
  `;
  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.production_promoted', ${JSON.stringify({ deploymentId: metadata.deploymentId, url: promoted.productionUrl || null })})
  `;

  return NextResponse.json({ ok: true, url: promoted.productionUrl, message: promoted.message }, { status: 201 });
}
