import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentStructuredArtifact } from "./agent-artifacts";
import { analyzeIdea } from "./planner";
import { defaultTaskGraph } from "./tasks";
import type { CreateProjectInput } from "./persistence";

type StoredProject = {
  id: string;
  name: string;
  idea: string;
  status: string;
  readiness_score: number;
  app_type: string;
  recommended_target: string;
  template_count: number;
  task_count: number;
  created_at: string;
  updated_at: string;
  plan: ReturnType<typeof analyzeIdea>;
};

export type StoredRun = {
  id: string;
  project_id: string;
  status: string;
  readiness_score: number;
  started_at: string;
  finished_at: string;
  agents: Array<{
    id: string;
    agent: string;
    phase?: string;
    task: string;
    status: string;
    summary: string;
    provider?: string;
    recommendations?: string[];
    artifacts?: string[];
    structuredArtifacts?: AgentStructuredArtifact[];
    handoffs?: string[];
    qualityChecks?: string[];
  }>;
  qa_checks: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    details: string;
  }>;
  artifact: {
    id: string;
    title: string;
    artifact_type: string;
    content: string;
  };
};

export type StoredDeployment = {
  id: string;
  project_id: string;
  provider: string;
  environment: string;
  status: string;
  url?: string;
  commit_sha?: string;
  details: string;
  commands: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  verified_at?: string;
};

export type StoredExport = {
  id: string;
  project_id: string;
  status: string;
  output_dir: string;
  file_count: number;
  summary: string;
  manifest: Record<string, unknown>;
  created_at: string;
};

export type StoredDatabaseSetup = {
  id: string;
  project_id: string;
  status: string;
  target: string;
  details: string;
  applied_files: string[];
  commands: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  finished_at?: string;
};

type StoreShape = {
  projects: StoredProject[];
  runs: StoredRun[];
  deployments: StoredDeployment[];
  exports: StoredExport[];
  databaseSetups: StoredDatabaseSetup[];
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "dev-projects.json");

export async function listLocalProjects() {
  const store = await readStore();
  return store.projects
    .map(({ plan: _plan, ...project }) => project)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getLocalProject(projectId: string) {
  const store = await readStore();
  return store.projects.find((project) => project.id === projectId) || null;
}

export async function listLocalRuns(projectId: string) {
  const store = await readStore();
  return store.runs
    .filter((run) => run.project_id === projectId)
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at));
}

export async function listLocalDeployments(projectId: string) {
  const store = await readStore();
  return store.deployments
    .filter((deployment) => deployment.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listLocalExports(projectId: string) {
  const store = await readStore();
  return store.exports
    .filter((generatedExport) => generatedExport.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listLocalDatabaseSetups(projectId: string) {
  const store = await readStore();
  return store.databaseSetups
    .filter((setup) => setup.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLocalStoreStats() {
  const store = await readStore();

  return {
    projectCount: store.projects.length,
    runCount: store.runs.length,
    qaCheckCount: store.runs.reduce((total, run) => total + run.qa_checks.length, 0),
    deploymentCount: store.deployments.length,
    exportCount: store.exports.length,
    databaseSetupCount: store.databaseSetups.length
  };
}

export async function createLocalPlannedProject(input: CreateProjectInput) {
  const store = await readStore();
  const plan = analyzeIdea(input);
  const now = new Date().toISOString();
  const project: StoredProject = {
    id: createId(),
    name: input.name || plan.title || "Untitled App",
    idea: input.idea,
    status: "planned",
    readiness_score: plan.readinessScore,
    app_type: plan.appType,
    recommended_target: plan.recommendedTarget,
    template_count: plan.templates.length,
    task_count: defaultTaskGraph.length,
    created_at: now,
    updated_at: now,
    plan
  };

  store.projects.unshift(project);
  await writeStore(store);
  const { plan: _plan, ...projectSummary } = project;

  return {
    project: projectSummary,
    plan,
    taskCount: defaultTaskGraph.length,
    templateCount: plan.templates.length,
    storage: "local"
  };
}

export async function createLocalAutomationRun(projectId: string, run: Omit<StoredRun, "id" | "project_id">) {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found");
  }

  const storedRun: StoredRun = {
    ...run,
    id: createId(),
    project_id: projectId
  };

  store.runs.unshift(storedRun);
  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    status: run.status,
    readiness_score: run.readiness_score,
    updated_at: run.finished_at
  };

  await writeStore(store);

  return storedRun;
}

export async function createLocalDeployment(projectId: string, deployment: Omit<StoredDeployment, "id" | "project_id" | "created_at">) {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found");
  }

  const now = new Date().toISOString();
  const storedDeployment: StoredDeployment = {
    ...deployment,
    id: createId(),
    project_id: projectId,
    created_at: now
  };

  store.deployments.unshift(storedDeployment);
  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    status: deployment.status,
    readiness_score: deployment.status === "deployment_ready" ? Math.max(store.projects[projectIndex].readiness_score, 94) : store.projects[projectIndex].readiness_score,
    updated_at: now
  };

  await writeStore(store);

  return storedDeployment;
}

export async function createLocalExport(projectId: string, generatedExport: Omit<StoredExport, "id" | "project_id" | "created_at">) {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found");
  }

  const now = new Date().toISOString();
  const storedExport: StoredExport = {
    ...generatedExport,
    id: createId(),
    project_id: projectId,
    created_at: now
  };

  store.exports.unshift(storedExport);
  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    status: generatedExport.status,
    readiness_score: Math.max(store.projects[projectIndex].readiness_score, 86),
    updated_at: now
  };

  await writeStore(store);

  return storedExport;
}

export async function createLocalDatabaseSetup(
  projectId: string,
  setup: Omit<StoredDatabaseSetup, "id" | "project_id" | "created_at">
) {
  const store = await readStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found");
  }

  const now = new Date().toISOString();
  const storedSetup: StoredDatabaseSetup = {
    ...setup,
    id: createId(),
    project_id: projectId,
    created_at: now
  };

  store.databaseSetups.unshift(storedSetup);
  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    status: setup.status,
    readiness_score:
      setup.status === "database_ready" ? Math.max(store.projects[projectIndex].readiness_score, 90) : store.projects[projectIndex].readiness_score,
    updated_at: now
  };

  await writeStore(store);

  return storedSetup;
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [],
      exports: Array.isArray(parsed.exports) ? parsed.exports : [],
      databaseSetups: Array.isArray(parsed.databaseSetups) ? parsed.databaseSetups : []
    };
  } catch {
    return { projects: [], runs: [], deployments: [], exports: [], databaseSetups: [] };
  }
}

async function writeStore(store: StoreShape) {
  if (process.env.VERCEL === "1") {
    throw new Error(
      "Project save needs Neon persistence on Vercel. Set DATABASE_URL or POSTGRES_URL, set APP_ENGINE_LOCAL_MODE=false, then run the engine database setup before saving projects."
    );
  }

  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function createId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
