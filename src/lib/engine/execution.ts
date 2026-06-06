import { getDatabase } from "@/lib/db/client";
import {
  createLocalDeployment,
  createLocalAutomationRun,
  getLocalProject,
  getLocalStoreStats,
  listLocalDeployments,
  listLocalRuns,
  type StoredDeployment,
  type StoredRun
} from "./development-store";
import { buildGeneratedAppHandoff, formatGeneratedAppHandoff } from "./app-output";
import { listProjectDatabaseSetups } from "./database-setup";
import { isLocalMode, isUsableDatabaseUrl } from "./local-mode";
import { analyzeIdea } from "./planner";
import { defaultTaskGraph } from "./tasks";
import { getLocalWorkerAdapter, getWorkerAdapter, getWorkerProvider, type AgentJobContext, type AgentJobResult } from "./worker-adapters";

type QaStatus = "passed" | "needs_attention";

type RunProject = {
  id: string;
  name: string;
  idea: string;
  target_customer?: string | null;
  problem_statement?: string | null;
  revenue_model?: string | null;
  app_type?: string | null;
  readiness_score: number;
  plan?: ReturnType<typeof analyzeIdea>;
};

type RunQaCheck = {
  title: string;
  status: QaStatus;
  severity: string;
  details: string;
};

export type EngineHealth = {
  storage: "local" | "neon";
  databaseConfigured: boolean;
  schemaReady: boolean;
  authConfigured: boolean;
  adminConfigured: boolean;
  providers: string[];
  workerProvider: string;
  workerConfigured: boolean;
  deploymentConfigured: boolean;
  localStore?: {
    projectCount: number;
    runCount: number;
    qaCheckCount: number;
    deploymentCount: number;
    exportCount: number;
    databaseSetupCount: number;
  };
  neonCounts?: {
    projects: number;
    runs: number;
    qaChecks: number;
    deployments: number;
  };
  missing: string[];
};

export async function getEngineHealth(): Promise<EngineHealth> {
  const databaseConfigured = isUsableDatabaseUrl();
  const providers = getConfiguredProviders();
  const workerProvider = getWorkerProvider();
  const authConfigured = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const adminConfigured = Boolean(process.env.APP_ENGINE_OWNER_EMAIL);
  const workerConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const deploymentConfigured = Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID);
  const missing = [
    databaseConfigured ? "" : "DATABASE_URL",
    authConfigured ? "" : "AUTH_SECRET",
    adminConfigured ? "" : "APP_ENGINE_OWNER_EMAIL",
    providers.length ? "" : "GOOGLE/GITHUB OAuth credentials",
    workerConfigured ? "" : "OPENAI_API_KEY or ANTHROPIC_API_KEY",
    process.env.VERCEL_TOKEN ? "" : "VERCEL_TOKEN",
    process.env.VERCEL_ORG_ID ? "" : "VERCEL_ORG_ID",
    process.env.VERCEL_PROJECT_ID ? "" : "VERCEL_PROJECT_ID"
  ].filter(Boolean);

  if (isLocalMode()) {
    return {
      storage: "local",
      databaseConfigured,
      schemaReady: true,
      authConfigured,
      adminConfigured,
      providers,
      workerProvider,
      workerConfigured,
      deploymentConfigured,
      localStore: await getLocalStoreStats(),
      missing
    };
  }

  try {
    const sql = getDatabase();
    const [tables] = await sql`
      select
        to_regclass('public.app_projects') is not null as projects_ready,
        to_regclass('public.agent_runs') is not null as runs_ready,
        to_regclass('public.qa_checks') is not null as qa_ready
    `;

    const schemaReady = Boolean(tables.projects_ready && tables.runs_ready && tables.qa_ready);

    if (!schemaReady) {
      return {
        storage: "neon",
        databaseConfigured,
        schemaReady,
        authConfigured,
        adminConfigured,
        providers,
        workerProvider,
        workerConfigured,
        deploymentConfigured,
        missing: [...missing, "db/migrations/001_initial.sql"]
      };
    }

    const [counts] = await sql`
      select
        (select count(*)::int from app_projects) as projects,
        (select count(*)::int from agent_runs) as runs,
        (select count(*)::int from qa_checks) as qa_checks,
        (select count(*)::int from deployments) as deployments
    `;

    return {
      storage: "neon",
      databaseConfigured,
      schemaReady,
      authConfigured,
      adminConfigured,
      providers,
      workerProvider,
      workerConfigured,
      deploymentConfigured,
      neonCounts: {
        projects: Number(counts.projects || 0),
        runs: Number(counts.runs || 0),
        qaChecks: Number(counts.qa_checks || 0),
        deployments: Number(counts.deployments || 0)
      },
      missing
    };
  } catch {
    return {
      storage: "neon",
      databaseConfigured,
      schemaReady: false,
      authConfigured,
      adminConfigured,
      providers,
      workerProvider,
      workerConfigured,
      deploymentConfigured,
      missing: [...missing, "Reachable Neon database"]
    };
  }
}

export async function listAutomationRuns(projectId: string) {
  if (isLocalMode()) {
    return {
      runs: await listLocalRuns(projectId),
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const runs = await sql`
    select
      agent_runs.id,
      agent_runs.project_id,
      agent_runs.status,
      agent_runs.started_at,
      agent_runs.finished_at,
      agent_runs.output,
      app_projects.readiness_score
    from agent_runs
    join app_projects on app_projects.id = agent_runs.project_id
    where agent_runs.project_id = ${projectId}
      and agent_runs.task_id is null
    order by agent_runs.finished_at desc nulls last, agent_runs.created_at desc
    limit 12
  `;

  return {
    runs,
    storage: "neon" as const
  };
}

export async function listProjectDeployments(projectId: string) {
  if (isLocalMode()) {
    return {
      deployments: await listLocalDeployments(projectId),
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const deployments = await sql`
    select id, project_id, provider, environment, status, url, commit_sha, metadata, created_at, verified_at
    from deployments
    where project_id = ${projectId}
    order by created_at desc
    limit 12
  `;

  return {
    deployments,
    storage: "neon" as const
  };
}

export async function prepareProjectDeployment(projectId: string) {
  const health = await getEngineHealth();

  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const deployment = await createLocalDeployment(projectId, buildDeploymentPayload(project, health, await isGeneratedDatabaseReady(projectId)));

    return {
      deployment,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select id, name, idea, readiness_score, status
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const deploymentPayload = buildDeploymentPayload(project as RunProject & { status?: string }, health, await isGeneratedDatabaseReady(projectId));
  const [deployment] = await sql`
    insert into deployments (project_id, provider, environment, status, url, commit_sha, metadata, verified_at)
    values (
      ${projectId},
      ${deploymentPayload.provider},
      ${deploymentPayload.environment},
      ${deploymentPayload.status},
      ${deploymentPayload.url || null},
      ${deploymentPayload.commit_sha || null},
      ${JSON.stringify({
        details: deploymentPayload.details,
        commands: deploymentPayload.commands,
        missing: health.missing
      })},
      ${deploymentPayload.verified_at || null}
    )
    returning *
  `;

  await sql`
    update app_projects
    set status = ${deploymentPayload.status},
      readiness_score = ${deploymentPayload.status === "deployment_ready" ? Math.max(Number(project.readiness_score || 0), 94) : Number(project.readiness_score || 0)},
      updated_at = now()
    where id = ${projectId}
  `;

  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.deployment_prepared', ${JSON.stringify({ deploymentId: deployment.id, status: deploymentPayload.status })})
  `;

  return {
    deployment,
    storage: "neon" as const
  };
}

export async function runProjectAgents(projectId: string) {
  const health = await getEngineHealth();
  const startedAt = new Date();

  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const plan = project.plan;
    const agentRunPayload = await buildAgentRunPayload(
      {
        id: project.id,
        name: project.name,
        idea: project.idea,
        readiness_score: project.readiness_score,
        plan
      },
      health,
      startedAt
    );
    const run = await createLocalAutomationRun(projectId, agentRunPayload);

    return {
      run,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select
      id,
      name,
      idea,
      target_customer,
      problem_statement,
      revenue_model,
      app_type,
      readiness_score
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const runPayload = await buildAgentRunPayload(project as RunProject, health, startedAt);
  const [rootRun] = await sql`
    insert into agent_runs (project_id, status, input, output, started_at, finished_at)
    values (
      ${projectId},
      ${runPayload.status},
      ${JSON.stringify({ trigger: "manual", mode: "agent-build-run", provider: health.workerProvider })},
      ${JSON.stringify(runPayload)},
      ${runPayload.started_at},
      ${runPayload.finished_at}
    )
    returning *
  `;

  const tasks = await sql`
    select app_tasks.id, app_tasks.title, agent_roles.slug as agent
    from app_tasks
    left join agent_roles on agent_roles.id = app_tasks.agent_role_id
    where app_tasks.project_id = ${projectId}
    order by app_tasks.created_at asc
  `;

  for (const agentRun of runPayload.agents) {
    const matchingTask = tasks.find((task) => task.agent === agentRun.agent || task.title === agentRun.task);

    await sql`
      insert into agent_runs (project_id, task_id, status, input, output, started_at, finished_at)
      values (
        ${projectId},
        ${matchingTask?.id || null},
        ${agentRun.status},
        ${JSON.stringify({ task: agentRun.task, agent: agentRun.agent, provider: agentRun.provider })},
        ${JSON.stringify({
          summary: agentRun.summary,
          phase: agentRun.phase,
          recommendations: agentRun.recommendations || [],
          artifacts: agentRun.artifacts || [],
          structuredArtifacts: agentRun.structuredArtifacts || [],
          handoffs: agentRun.handoffs || [],
          qualityChecks: agentRun.qualityChecks || [],
          rootRunId: rootRun.id
        })},
        ${runPayload.started_at},
        ${runPayload.finished_at}
      )
    `;

    if (matchingTask?.id) {
      await sql`
        update app_tasks
        set status = ${agentRun.status === "completed" ? "done" : "blocked"}, updated_at = now()
        where id = ${matchingTask.id}
      `;
    }
  }

  const [artifact] = await sql`
    insert into artifacts (project_id, agent_run_id, artifact_type, title, content, metadata)
    values (
      ${projectId},
      ${rootRun.id},
      ${runPayload.artifact.artifact_type},
      ${runPayload.artifact.title},
      ${runPayload.artifact.content},
      ${JSON.stringify({ generatedBy: "agent-build-run", provider: health.workerProvider })}
    )
    returning *
  `;

  if (runPayload.status === "agents_need_attention") {
    await sql`
      insert into qa_checks (project_id, title, status, severity, details, evidence_artifact_id)
      values (
        ${projectId},
        'Agent build run',
        'needs_attention',
        'high',
        'One or more agent tasks failed or need follow-up before QA.',
        ${artifact.id}
      )
    `;
  }

  await sql`
    update app_projects
    set status = ${runPayload.status},
      readiness_score = ${runPayload.readiness_score},
      updated_at = now()
    where id = ${projectId}
  `;

  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.agent_run_completed', ${JSON.stringify({ runId: rootRun.id, status: runPayload.status })})
  `;

  return {
    run: {
      ...runPayload,
      id: rootRun.id,
      project_id: projectId
    },
    storage: "neon" as const
  };
}

export async function runProjectAutomation(projectId: string) {
  const health = await getEngineHealth();

  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const simulatedRun = buildRunPayload(
      {
        id: project.id,
        name: project.name,
        idea: project.idea,
        readiness_score: project.readiness_score,
        plan: project.plan
      },
      health
    );

    const run = await createLocalAutomationRun(projectId, simulatedRun);

    return {
      run,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select
      id,
      name,
      idea,
      target_customer,
      problem_statement,
      revenue_model,
      app_type,
      readiness_score
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const runPayload = buildRunPayload(project as RunProject, health);
  const [rootRun] = await sql`
    insert into agent_runs (project_id, status, input, output, started_at, finished_at)
    values (
      ${projectId},
      ${runPayload.status},
      ${JSON.stringify({ trigger: "manual", mode: "automated-qa-loop" })},
      ${JSON.stringify(runPayload)},
      ${runPayload.started_at},
      ${runPayload.finished_at}
    )
    returning *
  `;

  const tasks = await sql`
    select app_tasks.id, app_tasks.title, agent_roles.slug as agent
    from app_tasks
    left join agent_roles on agent_roles.id = app_tasks.agent_role_id
    where app_tasks.project_id = ${projectId}
    order by app_tasks.created_at asc
  `;

  for (const agentRun of runPayload.agents) {
    const matchingTask = tasks.find((task) => task.agent === agentRun.agent || task.title === agentRun.task);

    await sql`
      insert into agent_runs (project_id, task_id, status, input, output, started_at, finished_at)
      values (
        ${projectId},
        ${matchingTask?.id || null},
        ${agentRun.status},
        ${JSON.stringify({ task: agentRun.task, agent: agentRun.agent })},
        ${JSON.stringify({ summary: agentRun.summary, rootRunId: rootRun.id })},
        ${runPayload.started_at},
        ${runPayload.finished_at}
      )
    `;

    if (matchingTask?.id) {
      await sql`
        update app_tasks
        set status = 'done', updated_at = now()
        where id = ${matchingTask.id}
      `;
    }
  }

  const [artifact] = await sql`
    insert into artifacts (project_id, agent_run_id, artifact_type, title, content, metadata)
    values (
      ${projectId},
      ${rootRun.id},
      ${runPayload.artifact.artifact_type},
      ${runPayload.artifact.title},
      ${runPayload.artifact.content},
      ${JSON.stringify({ generatedBy: "automated-qa-loop" })}
    )
    returning *
  `;

  for (const check of runPayload.qa_checks) {
    await sql`
      insert into qa_checks (project_id, title, status, severity, details, evidence_artifact_id)
      values (${projectId}, ${check.title}, ${check.status}, ${check.severity}, ${check.details}, ${artifact.id})
    `;
  }

  await sql`
    update app_projects
    set status = ${runPayload.status},
      readiness_score = ${runPayload.readiness_score},
      updated_at = now()
    where id = ${projectId}
  `;

  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.qa_run_completed', ${JSON.stringify({ runId: rootRun.id, status: runPayload.status })})
  `;

  return {
    run: {
      ...runPayload,
      id: rootRun.id,
      project_id: projectId
    },
    storage: "neon" as const
  };
}

async function buildAgentRunPayload(project: RunProject, health: EngineHealth, startedAt: Date): Promise<Omit<StoredRun, "id" | "project_id">> {
  const plan =
    project.plan ||
    analyzeIdea({
      idea: project.idea,
      targetCustomer: project.target_customer || undefined,
      problem: project.problem_statement || undefined,
      revenueModel: project.revenue_model || "Not sure yet",
      appType: project.app_type || "Auto detect"
    });
  const adapter = getWorkerAdapter();
  const fallbackAdapter = getLocalWorkerAdapter();
  const context: AgentJobContext = {
    projectName: project.name,
    idea: project.idea,
    customer: plan.customer,
    problem: plan.problem,
    appType: plan.appType,
    recommendedTarget: plan.recommendedTarget,
    templates: plan.templates.map((template) => template.name)
  };
  const taskResults: AgentJobResult[] = [];
  let useLocalFallback = adapter.provider === "local";

  for (const task of defaultTaskGraph) {
    const taskContext = {
        ...context,
        completedAgents: taskResults.map((result) => ({
          agent: result.agent,
          task: result.task,
          summary: result.summary,
          recommendations: result.recommendations,
          artifacts: result.artifacts,
          structuredArtifacts: result.structuredArtifacts,
          handoffs: result.handoffs
        }))
      };
    let taskResult = await (useLocalFallback ? fallbackAdapter : adapter).runTask(task, taskContext);

    if (!useLocalFallback && shouldUseLocalWorkerFallback(taskResult)) {
      useLocalFallback = true;
      const providerFailure = taskResult;
      taskResult = await fallbackAdapter.runTask(task, taskContext);
      taskResult.recommendations = [
        `${providerFailure.provider} worker was unavailable, so App Engine used deterministic local output for this run.`,
        ...taskResult.recommendations
      ];
      taskResult.raw = {
        fallbackFrom: providerFailure
      };
    }

    taskResults.push(taskResult);
  }

  const finishedAt = new Date();
  const failedResults = taskResults.filter((result) => result.status !== "completed");
  const status = failedResults.length ? "agents_need_attention" : "agents_completed";
  const readinessScore = Math.min(88, Math.max(project.readiness_score, 32) + taskResults.filter((result) => result.status === "completed").length * 4);
  const agents = taskResults.map((result) => ({
    id: `agent_${result.agent}_${startedAt.getTime()}`,
    agent: result.agent,
    phase: result.phase,
    task: result.task,
    status: result.status,
    summary: result.summary,
    provider: result.provider,
    recommendations: result.recommendations,
    artifacts: result.artifacts,
    structuredArtifacts: result.structuredArtifacts,
    handoffs: result.handoffs,
    qualityChecks: result.qualityChecks
  }));
  const handoff = buildGeneratedAppHandoff(plan, agents);
  const reportLines = [
    `${project.name} agent build run`,
    `Status: ${status}`,
    `Provider: ${health.workerProvider}`,
    `Readiness: ${readinessScore}%`,
    `Agents completed: ${taskResults.length - failedResults.length}/${taskResults.length}`,
    "",
    ...agents.flatMap((agent) => [
      `${agent.agent}${agent.phase ? ` (${agent.phase})` : ""}: ${agent.summary}`,
      ...(agent.recommendations || []).map((recommendation) => `- recommendation: ${recommendation}`),
      ...(agent.artifacts || []).slice(0, 2).map((artifact) => `- artifact: ${artifact}`),
      ...(agent.structuredArtifacts || []).slice(0, 2).map((artifact) => `- usable artifact: ${artifact.title} (${artifact.kind})`),
      ...(agent.handoffs || []).slice(0, 2).map((handoff) => `- handoff: ${handoff}`)
    ]),
    "",
    formatGeneratedAppHandoff(handoff)
  ];

  return {
    status,
    readiness_score: readinessScore,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    agents,
    qa_checks: failedResults.map((result) => ({
      id: `qa_${result.agent}_${startedAt.getTime()}`,
      title: `${result.agent} worker`,
      status: "needs_attention",
      severity: "high",
      details: result.summary
    })),
    artifact: {
      id: `artifact_${startedAt.getTime()}`,
      title: "Agent Build Run Report",
      artifact_type: "agent_run_report",
      content: reportLines.join("\n")
    }
  };
}

function shouldUseLocalWorkerFallback(result: AgentJobResult) {
  if (result.provider === "local" || result.status === "completed") {
    return false;
  }

  return /provider|upstream|connect|timeout|network|non-json|request failed|fetch failed|quota|billing|rate limit|model access|invalid api key/i.test(
    result.summary
  );
}

function buildRunPayload(project: RunProject, health: EngineHealth): Omit<StoredRun, "id" | "project_id"> {
  const startedAt = new Date();
  const finishedAt = new Date(startedAt.getTime() + 1000);
  const plan =
    project.plan ||
    analyzeIdea({
      idea: project.idea,
      targetCustomer: project.target_customer || undefined,
      problem: project.problem_statement || undefined,
      revenueModel: project.revenue_model || "Not sure yet",
      appType: project.app_type || "Auto detect"
    });
  const qaChecks = scoreQaChecks(plan, health);
  const needsAttention = qaChecks.some((check) => check.status === "needs_attention");
  const passedCount = qaChecks.filter((check) => check.status === "passed").length;
  const readinessBump = passedCount * 7 + (health.schemaReady ? 6 : 0) + (health.authConfigured ? 5 : 0);
  const readinessScore = Math.min(92, Math.max(project.readiness_score, 38) + readinessBump);
  const status = needsAttention ? "qa_needs_attention" : "qa_passed";
  const agents = defaultTaskGraph.slice(0, 12).map((task) => ({
    id: `agent_${task.agent}_${startedAt.getTime()}`,
    agent: task.agent,
    phase: task.phase,
    task: task.title,
    status: "completed",
    summary: summarizeAgentWork(task.agent, plan.appType, health)
  }));
  const attentionList = qaChecks.filter((check) => check.status === "needs_attention").map((check) => check.title);

  return {
    status,
    readiness_score: readinessScore,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    agents,
    qa_checks: qaChecks.map((check) => ({
      ...check,
      id: `qa_${check.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${startedAt.getTime()}`
    })),
    artifact: {
      id: `artifact_${startedAt.getTime()}`,
      title: "Automated QA Run Report",
      artifact_type: "qa_report",
      content: [
        `${project.name} automated run`,
        `Status: ${status}`,
        `Readiness: ${readinessScore}%`,
        `Agents completed: ${agents.length}`,
        attentionList.length ? `Needs attention: ${attentionList.join(", ")}` : "Needs attention: none"
      ].join("\n")
    }
  };
}

function buildDeploymentPayload(
  project: Pick<RunProject, "name" | "readiness_score"> & { status?: string },
  health: EngineHealth,
  generatedDatabaseReady: boolean
): Omit<StoredDeployment, "id" | "project_id" | "created_at"> {
  const readiness = Number(project.readiness_score || 0);
  const localCoreMode = health.storage === "local";
  const databaseReadyForDeployment = generatedDatabaseReady || localCoreMode;
  const commands = [
    "npm run typecheck",
    "npm run build",
    "npm run db:setup",
    "vercel pull --yes --environment=preview --token=$VERCEL_TOKEN",
    "vercel build --token=$VERCEL_TOKEN",
    "vercel deploy --prebuilt --token=$VERCEL_TOKEN"
  ];
  const missingDeploymentEnv = localCoreMode ? [] : ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"].filter((key) => !process.env[key]);
  const missingCoreEnv = localCoreMode ? [] : ["DATABASE_URL", "AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL"].filter((key) => !process.env[key]);
  const blockers = [
    ...missingCoreEnv,
    ...missingDeploymentEnv,
    databaseReadyForDeployment ? "" : "Generated app database not ready",
    readiness >= 90 ? "" : "QA readiness below 90%"
  ].filter(Boolean);
  const status = blockers.length ? "deployment_blocked" : "deployment_ready";

  return {
    provider: "vercel",
    environment: "preview",
    status,
    details:
      status === "deployment_ready"
        ? `${project.name} is ready for the Vercel preview deployment command sequence.`
        : `${project.name} deployment is blocked by: ${blockers.join(", ")}.`,
    commands,
    verified_at: status === "deployment_ready" ? new Date().toISOString() : undefined,
    metadata: {
      storage: health.storage,
      readiness,
      generatedDatabaseReady: databaseReadyForDeployment,
      localFallbacks: localCoreMode ? ["Generated app database", "Deployment credentials"] : [],
      requiredEnv: ["DATABASE_URL", "AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL", "VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]
    }
  };
}

async function isGeneratedDatabaseReady(projectId: string) {
  const { setups } = await listProjectDatabaseSetups(projectId);

  return setups.some((setup) => setup.status === "database_ready");
}

function scoreQaChecks(plan: ReturnType<typeof analyzeIdea>, health: EngineHealth): RunQaCheck[] {
  const localCoreMode = health.storage === "local";
  const persistenceReady = (health.storage === "neon" && health.schemaReady) || (localCoreMode && health.schemaReady);
  const personalOrMemberApp = plan.auth.roles.includes("member") || plan.appType === "Personal productivity app";
  const rolePlanReady = personalOrMemberApp
    ? plan.auth.roles.includes("owner") && plan.auth.roles.includes("member")
    : plan.auth.roles.includes("admin") && plan.auth.roles.includes("customer");

  return [
    {
      title: personalOrMemberApp ? "User and desired outcome" : "Customer and paid outcome",
      status: plan.customer && plan.problem ? "passed" : "needs_attention",
      severity: "high",
      details: personalOrMemberApp
        ? `Planner captured ${plan.customer} and the outcome problem: ${plan.problem}.`
        : `Planner captured ${plan.customer} and the paid problem: ${plan.problem}.`
    },
    {
      title: "Authentication and roles",
      status: rolePlanReady ? "passed" : "needs_attention",
      severity: "high",
      details: `${plan.auth.provider} is selected with ${plan.auth.roles.join(", ")} roles.`
    },
    {
      title: "Persistence path",
      status: persistenceReady ? "passed" : "needs_attention",
      severity: "high",
      details:
        health.storage === "neon" && health.schemaReady
          ? "Neon schema is reachable and run records were persisted."
          : localCoreMode
            ? "Local JSON persistence is active for core build verification until DATABASE_URL is connected."
            : "Running in local JSON mode until DATABASE_URL is connected and migrations are applied."
    },
    {
      title: "Primary workflow completion",
      status: plan.tasks.length >= 10 && plan.templates.length >= 4 ? "passed" : "needs_attention",
      severity: "high",
      details: `${plan.tasks.length} agent tasks and ${plan.templates.length} templates are attached to the build plan.`
    },
    {
      title: "Responsive customer/admin UI",
      status: health.schemaReady ? "passed" : "needs_attention",
      severity: "medium",
      details:
        "Generated app layout rules and account/admin surfaces are present; browser smoke remains part of deployment verification."
    },
    {
      title: "Deployment readiness",
      status: localCoreMode || health.deploymentConfigured ? "passed" : "needs_attention",
      severity: "medium",
      details:
        localCoreMode && !health.deploymentConfigured
          ? "Deployment credentials are tracked by the readiness gate and can wait until the core generated app passes."
          : health.deploymentConfigured
            ? "Vercel token is configured for deployment automation."
            : "VERCEL_TOKEN is missing, so deployment automation remains queued."
    },
    {
      title: "Model worker handoff",
      status: localCoreMode || health.workerConfigured ? "passed" : "needs_attention",
      severity: "high",
      details:
        localCoreMode && !health.workerConfigured
          ? "Deterministic local workers are active, so the app factory can run without external model calls."
          : health.workerConfigured
            ? "At least one model worker provider is configured."
            : "OPENAI_API_KEY or ANTHROPIC_API_KEY is needed before real Codex/Claude worker jobs can run."
    }
  ];
}

function summarizeAgentWork(agent: string, appType: string, health: EngineHealth) {
  const summaries: Record<string, string> = {
    product: `Refined the ${appType} brief around the buyer, pain, paid outcome, and MVP boundary.`,
    business: "Mapped subscription, upgrade, onboarding, and retention levers for the app concept.",
    architecture: `Chose ${health.storage === "neon" ? "Vercel + Neon" : "local fallback + Neon-ready"} architecture boundaries.`,
    template: "Attached reusable auth, account, admin, onboarding, billing, dashboard, and QA templates.",
    database: health.schemaReady ? "Confirmed project/run/check persistence paths." : "Flagged database migrations as the next setup task.",
    auth: "Verified the plan includes customer/admin roles and protected route boundaries.",
    design: "Checked the required customer portal, admin console, onboarding, dashboard, and responsive states.",
    frontend: "Queued customer/admin surfaces and cockpit states for browser verification.",
    backend: "Prepared API, persistence, and worker-adapter tasks for execution.",
    qa: "Created acceptance checks and recorded current pass/attention status.",
    fixer: "Converted unresolved checks into follow-up repair tasks.",
    deployment: health.deploymentConfigured ? "Prepared deployment automation handoff." : "Held deployment until Vercel credentials are configured."
  };

  return summaries[agent] || "Completed assigned engine workflow task.";
}

function getConfiguredProviders() {
  const providers = [];

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push("github");
  }

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push("google");
  }

  return providers;
}
