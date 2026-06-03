import { getDatabase } from "@/lib/db/client";
import { listGeneratedAppExports } from "./app-generator";
import { listProjectDatabaseSetups } from "./database-setup";
import { getLocalProject } from "./development-store";
import { getEngineHealth, listAutomationRuns, listProjectDeployments } from "./execution";
import { isLocalMode } from "./local-mode";

type ReadinessStatus = "ready" | "needs_review" | "blocked";
type ReadinessItemStatus = "ready" | "warning" | "blocked";

type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  readiness_score: number;
};

type ReadinessRun = {
  status?: string;
  readiness_score?: number;
  finished_at?: string;
  output?: {
    readiness_score?: number;
    qa_checks?: Array<{ status?: string }>;
  };
  qa_checks?: Array<{ status?: string }>;
};

type ReadinessDeployment = {
  status?: string;
  details?: string;
  metadata?: {
    details?: string;
  };
  created_at?: string;
};

type ReadinessExport = {
  status?: string;
  file_count?: number;
  uri?: string;
  output_dir?: string;
  created_at?: string;
};

type ReadinessDatabaseSetup = {
  status?: string;
  details?: string;
  target?: string;
  created_at?: string;
  finished_at?: string;
};

export type ProjectReadinessItem = {
  id: string;
  label: string;
  group: string;
  status: ReadinessItemStatus;
  weight: number;
  details: string;
  evidence: string;
  nextAction: string;
};

export type ProjectReadinessReport = {
  projectId: string;
  projectName: string;
  status: ReadinessStatus;
  score: number;
  nextAction: string;
  blockers: ProjectReadinessItem[];
  warnings: ProjectReadinessItem[];
  items: ProjectReadinessItem[];
  generatedAt: string;
};

export async function getProjectLaunchReadiness(projectId: string): Promise<ProjectReadinessReport> {
  const project = await getProjectSummary(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const [health, runResult, deploymentResult, exportResult, databaseResult] = await Promise.all([
    getEngineHealth(),
    listAutomationRuns(projectId),
    listProjectDeployments(projectId),
    listGeneratedAppExports(projectId),
    listProjectDatabaseSetups(projectId)
  ]);

  const runs = runResult.runs as ReadinessRun[];
  const deployments = deploymentResult.deployments as ReadinessDeployment[];
  const generatedExports = exportResult.exports as ReadinessExport[];
  const databaseSetups = databaseResult.setups as ReadinessDatabaseSetup[];
  const latestAgentRun = runs.find((run) => run.status === "agents_completed" || run.status === "agents_need_attention");
  const latestQaRun = runs.find((run) => run.status === "qa_passed" || run.status === "qa_needs_attention");
  const latestExport = generatedExports[0] || null;
  const latestDatabaseSetup = databaseSetups[0] || null;
  const latestDeployment = deployments[0] || null;
  const items: ProjectReadinessItem[] = [
    createReadinessItem({
      id: "plan",
      label: "Build plan",
      group: "Planning",
      weight: 8,
      ready: project.readiness_score >= 25,
      details: `${project.name} is saved with ${project.readiness_score}% project readiness.`,
      blockedDetails: "Save the analyzed plan before the engine can coordinate agents, output, QA, and deployment.",
      evidence: project.status || "planned",
      nextAction: "Save Project"
    }),
    createReadinessItem({
      id: "agent-build",
      label: "Agent build run",
      group: "Automation",
      weight: 14,
      ready: latestAgentRun?.status === "agents_completed",
      blocked: !latestAgentRun || latestAgentRun.status === "agents_need_attention",
      details: "The agent build run completed and produced the app handoff.",
      blockedDetails: latestAgentRun?.status === "agents_need_attention" ? "At least one agent worker needs attention." : "Agents have not produced a build handoff yet.",
      evidence: latestAgentRun ? `${latestAgentRun.status} at ${formatOptionalDate(latestAgentRun.finished_at)}` : "No agent run recorded",
      nextAction: "Run Agents"
    }),
    createReadinessItem({
      id: "generated-app",
      label: "Generated app bundle",
      group: "Output",
      weight: 14,
      ready: Boolean(latestExport),
      details: `Generated app files are available${latestExport?.file_count ? ` with ${latestExport.file_count} files` : ""}.`,
      blockedDetails: "No generated app bundle is available for QA, database setup, or deployment.",
      evidence: latestExport?.output_dir || latestExport?.uri || "No export recorded",
      nextAction: "Generate App"
    }),
    createReadinessItem({
      id: "generated-database",
      label: "Generated app database",
      group: "Data",
      weight: 16,
      ready: latestDatabaseSetup?.status === "database_ready",
      blocked: !latestDatabaseSetup || latestDatabaseSetup.status !== "database_ready",
      details: "The generated schema and seed data have been applied to the target Neon database.",
      blockedDetails: latestDatabaseSetup?.details || "The generated app database has not been prepared.",
      evidence: latestDatabaseSetup
        ? `${latestDatabaseSetup.status || "database_setup"} on ${latestDatabaseSetup.target || "unknown target"}`
        : "No database setup run recorded",
      nextAction: latestExport ? "Setup DB" : "Generate App"
    }),
    createReadinessItem({
      id: "qa-loop",
      label: "QA loop",
      group: "Verification",
      weight: 18,
      ready: latestQaRun?.status === "qa_passed",
      blocked: !latestQaRun || latestQaRun.status === "qa_needs_attention",
      details: "The automated QA loop passed the current launch checks.",
      blockedDetails: latestQaRun?.status === "qa_needs_attention" ? summarizeQaAttention(latestQaRun) : "Run QA after agents, export, and database setup.",
      evidence: latestQaRun ? `${latestQaRun.status} at ${formatOptionalDate(latestQaRun.finished_at)}` : "No QA run recorded",
      nextAction: "Run QA Loop"
    }),
    createReadinessItem({
      id: "engine-database",
      label: "Engine database",
      group: "Production setup",
      weight: 8,
      ready: health.databaseConfigured && health.schemaReady,
      details: "The engine database is configured and the schema is ready.",
      blockedDetails: health.databaseConfigured ? "The engine database is configured, but migrations or connectivity still need attention." : "DATABASE_URL is missing.",
      evidence: `${health.storage} storage`,
      nextAction: "Set DATABASE_URL and apply engine migrations"
    }),
    createReadinessItem({
      id: "auth-admin",
      label: "Auth and admin access",
      group: "Production setup",
      weight: 8,
      ready: health.authConfigured && health.adminConfigured,
      details: "Auth secret and owner admin email are configured.",
      blockedDetails: "AUTH_SECRET and APP_ENGINE_OWNER_EMAIL are required for production sign-in and admin access.",
      evidence: health.providers.length ? `${health.providers.join(", ")} OAuth` : "No OAuth provider configured",
      nextAction: "Set AUTH_SECRET and APP_ENGINE_OWNER_EMAIL"
    }),
    createReadinessItem({
      id: "model-workers",
      label: "Model workers",
      group: "Automation",
      weight: 6,
      ready: health.workerConfigured,
      details: `Model worker provider is configured through ${health.workerProvider}.`,
      blockedDetails: "Real multi-agent work needs OPENAI_API_KEY or ANTHROPIC_API_KEY. Local worker mode is only a fallback.",
      evidence: health.workerProvider,
      nextAction: "Set OPENAI_API_KEY or ANTHROPIC_API_KEY"
    }),
    createReadinessItem({
      id: "deployment-env",
      label: "Vercel deployment credentials",
      group: "Deployment",
      weight: 4,
      ready: health.deploymentConfigured,
      details: "Vercel deployment credentials are configured.",
      blockedDetails: "VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID are required to deploy automatically.",
      evidence: health.deploymentConfigured ? "Configured" : "Vercel credentials missing",
      nextAction: "Set Vercel deployment environment variables"
    }),
    createReadinessItem({
      id: "deployment-prep",
      label: "Deployment preparation",
      group: "Deployment",
      weight: 4,
      ready: latestDeployment?.status === "deployment_ready",
      blocked: !latestDeployment || latestDeployment.status !== "deployment_ready",
      details: "Deployment command path is ready for Vercel preview.",
      blockedDetails: latestDeployment ? getDeploymentDetails(latestDeployment) : "Prepare deployment after QA and database setup are ready.",
      evidence: latestDeployment ? `${latestDeployment.status} at ${formatOptionalDate(latestDeployment.created_at)}` : "No deployment record",
      nextAction: "Prepare Deploy"
    })
  ];
  const score = Math.round(
    items.reduce((total, item) => {
      if (item.status === "ready") {
        return total + item.weight;
      }

      if (item.status === "warning") {
        return total + item.weight * 0.5;
      }

      return total;
    }, 0)
  );
  const blockers = items.filter((item) => item.status === "blocked");
  const warnings = items.filter((item) => item.status === "warning");
  const status: ReadinessStatus = blockers.length ? "blocked" : warnings.length ? "needs_review" : "ready";

  return {
    projectId,
    projectName: project.name,
    status,
    score,
    nextAction: blockers[0]?.nextAction || warnings[0]?.nextAction || "Open the preview deployment and run final smoke tests",
    blockers,
    warnings,
    items,
    generatedAt: new Date().toISOString()
  };
}

async function getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      readiness_score: project.readiness_score
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select id, name, status, readiness_score
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    return null;
  }

  return {
    id: String(project.id),
    name: String(project.name || "Untitled App"),
    status: String(project.status || "planned"),
    readiness_score: Number(project.readiness_score || 0)
  };
}

function createReadinessItem(input: {
  id: string;
  label: string;
  group: string;
  weight: number;
  ready: boolean;
  blocked?: boolean;
  details: string;
  blockedDetails: string;
  evidence: string;
  nextAction: string;
}): ProjectReadinessItem {
  const status: ReadinessItemStatus = input.ready ? "ready" : input.blocked === false ? "warning" : "blocked";

  return {
    id: input.id,
    label: input.label,
    group: input.group,
    status,
    weight: input.weight,
    details: input.ready ? input.details : input.blockedDetails,
    evidence: input.evidence,
    nextAction: input.ready ? "Complete" : input.nextAction
  };
}

function summarizeQaAttention(run: ReadinessRun) {
  const checks = run.qa_checks || run.output?.qa_checks || [];
  const attentionCount = checks.filter((check) => check.status === "needs_attention").length;

  return attentionCount
    ? `${attentionCount} QA check${attentionCount === 1 ? "" : "s"} still need attention.`
    : "The latest QA loop needs attention.";
}

function getDeploymentDetails(deployment: ReadinessDeployment) {
  return deployment.details || deployment.metadata?.details || "Deployment is not ready yet.";
}

function formatOptionalDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "unknown time";
}
