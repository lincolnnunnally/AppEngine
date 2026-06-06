"use client";

import { useEffect, useMemo, useState } from "react";

type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  includes: string[];
};

type Task = {
  agent: string;
  phase: string;
  title: string;
  description: string;
  dependsOn: string[];
  priority: string;
  status: string;
  expectedArtifacts?: string[];
  acceptanceCriteria?: string[];
};

type QaCheck = {
  title: string;
  description: string;
  severity: string;
  status: string;
};

type Plan = {
  title: string;
  customer: string;
  problem: string;
  appType: string;
  recommendedTarget: string;
  readinessScore: number;
  valueProposition: string;
  auth: {
    provider: string;
    roles: string[];
    protectedRoutes: string[];
  };
  templates: Template[];
  tasks: Task[];
  qaChecks: QaCheck[];
  stack: string[];
  nextActions: string[];
};

type SavedProject = {
  id: string;
  name: string;
  status: string;
  readiness_score: number;
  app_type?: string;
  recommended_target?: string;
  template_count?: number;
  task_count?: number;
  updated_at: string;
};

type EngineHealth = {
  storage: "local" | "neon";
  databaseConfigured: boolean;
  schemaReady: boolean;
  authConfigured: boolean;
  adminConfigured: boolean;
  providers: string[];
  workerProvider: string;
  workerConfigured: boolean;
  deploymentConfigured: boolean;
  missing: string[];
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
};

type EngineRun = {
  id: string;
  project_id: string;
  status: string;
  readiness_score?: number;
  started_at?: string;
  finished_at?: string;
  agents?: Array<{
    id: string;
    agent: string;
    phase?: string;
    task: string;
    status: string;
    summary: string;
    provider?: string;
    recommendations?: string[];
    artifacts?: string[];
    structuredArtifacts?: Array<{
      kind: string;
      title: string;
      summary: string;
      data: Record<string, unknown>;
    }>;
    handoffs?: string[];
    qualityChecks?: string[];
  }>;
  qa_checks?: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    details: string;
  }>;
  artifact?: {
    title: string;
    artifact_type: string;
    content: string;
  };
  output?: {
    readiness_score?: number;
    agents?: EngineRun["agents"];
    qa_checks?: EngineRun["qa_checks"];
    artifact?: EngineRun["artifact"];
  };
};

type EngineDeployment = {
  id: string;
  project_id: string;
  provider: string;
  environment: string;
  status: string;
  url?: string;
  commit_sha?: string;
  details?: string;
  commands?: string[];
  metadata?: {
    details?: string;
    commands?: string[];
  };
  created_at: string;
  verified_at?: string;
};

type EngineExport = {
  id: string;
  project_id: string;
  status?: string;
  output_dir?: string;
  file_count?: number;
  summary?: string;
  manifest?: {
    files?: string[];
  };
  uri?: string;
  metadata?: {
    files?: string[];
  };
  created_at: string;
};

type EngineDatabaseSetup = {
  id: string;
  project_id: string;
  status: string;
  target: string;
  details: string;
  applied_files?: string[];
  commands?: string[];
  metadata?: {
    applied_files?: string[];
    commands?: string[];
    databaseEnvKeys?: string[];
  };
  created_at: string;
  finished_at?: string;
};

type EngineReadinessItem = {
  id: string;
  label: string;
  group: string;
  status: "ready" | "warning" | "blocked";
  weight: number;
  details: string;
  evidence: string;
  nextAction: string;
};

type EngineReadinessReport = {
  projectId: string;
  projectName: string;
  status: "ready" | "needs_review" | "blocked";
  score: number;
  nextAction: string;
  blockers: EngineReadinessItem[];
  warnings: EngineReadinessItem[];
  items: EngineReadinessItem[];
  generatedAt: string;
};

type EngineAutopilotResult = {
  projectId: string;
  status: "completed" | "blocked" | "max_steps_reached";
  steps: Array<{
    action: string;
    status: "completed" | "blocked";
    details: string;
  }>;
  readiness: EngineReadinessReport;
};

type EngineSetupVariable = {
  name: string;
  label: string;
  kind: "required" | "either" | "optional";
  present: boolean;
};

type EngineSetupPhase = {
  id: string;
  title: string;
  status: "ready" | "partial" | "missing";
  details: string;
  nextAction: string;
  variables: EngineSetupVariable[];
};

type EngineSetupProfile = {
  status: "ready" | "partial" | "missing";
  nextAction: string;
  phases: EngineSetupPhase[];
  requiredMissing: string[];
  generatedAt: string;
};

type AgentRole = {
  slug: string;
  name: string;
  phase: string;
  purpose: string;
  mission: string;
  responsibilities: string[];
  deliverables: string[];
  handoffTo: string[];
  qualityBar: string[];
  task: {
    title: string;
    description: string;
    dependsOn: string[];
    priority: string;
  };
};

export function AppEngineCockpit() {
  const [idea, setIdea] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [problem, setProblem] = useState("");
  const [revenueModel, setRevenueModel] = useState("Not sure yet");
  const [appType, setAppType] = useState("Auto detect");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [runs, setRuns] = useState<EngineRun[]>([]);
  const [deployments, setDeployments] = useState<EngineDeployment[]>([]);
  const [exports, setExports] = useState<EngineExport[]>([]);
  const [databaseSetups, setDatabaseSetups] = useState<EngineDatabaseSetup[]>([]);
  const [readinessReport, setReadinessReport] = useState<EngineReadinessReport | null>(null);
  const [autopilotResult, setAutopilotResult] = useState<EngineAutopilotResult | null>(null);
  const [setupProfile, setSetupProfile] = useState<EngineSetupProfile | null>(null);
  const [agentRoles, setAgentRoles] = useState<AgentRole[]>([]);
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [storage, setStorage] = useState("local");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    void loadHealth();
    void loadSetupProfile();
    void loadAgentRoles();
    void refreshProjects();
  }, []);

  const activeProject = useMemo(
    () => savedProjects.find((project) => project.id === currentProjectId) || null,
    [currentProjectId, savedProjects]
  );
  const latestRun = runs[0] || null;
  const latestDeployment = deployments[0] || null;
  const latestExport = exports[0] || null;
  const latestDatabaseSetup = databaseSetups[0] || null;
  const readinessItems = readinessReport?.items || [];
  const readinessBlockers = readinessReport?.blockers || [];
  const setupPhases = setupProfile?.phases || [];
  const latestRunQaChecks = getRunQaChecks(latestRun);
  const latestRunAgents = getRunAgents(latestRun);
  const factoryStages = [
    {
      label: "Plan",
      status: plan || activeProject ? "ready" : "waiting",
      detail: plan?.recommendedTarget || activeProject?.recommended_target || "Analyze an app idea"
    },
    {
      label: "Agents",
      status: latestRunAgents.length ? "ready" : currentProjectId ? "waiting" : "blocked",
      detail: latestRunAgents.length ? `${latestRunAgents.length} specialists completed` : "Run agent build"
    },
    {
      label: "Bundle",
      status: latestExport ? "ready" : currentProjectId ? "waiting" : "blocked",
      detail: latestExport ? `${latestExport.file_count || getExportFiles(latestExport).length} files exported` : "Generate app bundle"
    },
    {
      label: "Data",
      status: latestDatabaseSetup?.status === "database_ready" || (storage === "local" && latestExport) ? "ready" : latestExport ? "waiting" : "blocked",
      detail: latestDatabaseSetup?.details || (storage === "local" && latestExport ? "Local fallback data active" : "Setup generated database")
    },
    {
      label: "QA",
      status: latestRun?.status === "qa_passed" ? "ready" : latestRun ? "waiting" : "blocked",
      detail: latestRun ? formatStatus(latestRun.status) : "Run QA loop"
    },
    {
      label: "Deploy",
      status: latestDeployment?.status === "deployment_ready" ? "ready" : latestDeployment ? "waiting" : "blocked",
      detail: latestDeployment ? formatStatus(latestDeployment.status) : "Prepare Vercel preview"
    }
  ];
  const healthReady =
    health?.schemaReady && health.authConfigured && health.adminConfigured && health.workerConfigured && health.deploymentConfigured;
  const busy = Boolean(busyAction);

  const taskCounts = useMemo(() => {
    const tasks = plan?.tasks || [];
    return {
      total: tasks.length,
      high: tasks.filter((task) => task.priority === "high").length,
      agents: new Set(tasks.map((task) => task.agent)).size
    };
  }, [plan]);

  async function analyze() {
    if (!hasUsableIdea()) {
      return null;
    }

    setBusyAction("plan");
    setStatus("Analyzing");
    setError("");

    try {
      const response = await fetch("/api/engine/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(getIntakePayload())
      });

      const payload = await readJsonResponse<Plan>(response, "Analyzer failed");

      setPlan(payload);
      setStatus("Planned");
      await refreshProjects();
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analyzer failed");
      setStatus("Needs attention");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function startProjectBuild() {
    if (!hasUsableIdea()) {
      return;
    }

    setBusyAction("start");
    setStatus("Creating project");
    setError("");

    try {
      const payload = await createProjectRecord();
      const projectId = payload.project.id;

      setStatus("Autopilot running");

      const autopilotResponse = await fetch(`/api/engine/projects/${projectId}/autopilot`, {
        method: "POST"
      });
      const autopilotPayload = await readJsonResponse<EngineAutopilotResult>(autopilotResponse, "Autopilot failed");

      setAutopilotResult(autopilotPayload);
      setReadinessReport(autopilotPayload.readiness);
      await refreshProjectWorkspace(projectId);
      setStatus(autopilotPayload.status === "completed" ? "Autopilot complete" : "Autopilot blocked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project build failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function saveProject() {
    setBusyAction("save");
    setStatus("Saving");
    setError("");

    try {
      await createProjectRecord();
      setStatus("Saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project save failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function runAutopilot() {
    if (!currentProjectId) {
      setError("Save or select a project before running autopilot.");
      return;
    }

    setBusyAction("autopilot");
    setStatus("Autopilot running");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/autopilot`, {
        method: "POST"
      });
      const payload = await readJsonResponse<EngineAutopilotResult>(response, "Autopilot failed");

      setAutopilotResult(payload);
      setReadinessReport(payload.readiness);
      await refreshProjects();
      await Promise.all([
        refreshRuns(currentProjectId),
        refreshDeployments(currentProjectId),
        refreshExports(currentProjectId),
        refreshDatabaseSetups(currentProjectId),
        loadSetupProfile(),
        loadHealth()
      ]);
      setStatus(payload.status === "completed" ? "Autopilot complete" : "Autopilot blocked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Autopilot failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function runAutomation() {
    if (!currentProjectId) {
      setError("Save or select a project before running QA.");
      return;
    }

    setBusyAction("qa");
    setStatus("Running QA");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/runs`, {
        method: "POST"
      });
      const payload = await readJsonResponse<{ run: EngineRun }>(response, "Automation run failed");

      await refreshProjects();
      await Promise.all([refreshRuns(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.run.status === "qa_passed" ? "QA passed" : "QA needs attention");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automation run failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function runAgents() {
    if (!currentProjectId) {
      setError("Save or select a project before running agents.");
      return;
    }

    setBusyAction("agents");
    setStatus("Running agents");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/agents`, {
        method: "POST"
      });
      const payload = await readJsonResponse<{ run: EngineRun }>(response, "Agent build run failed");

      await refreshProjects();
      await Promise.all([refreshRuns(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.run.status === "agents_completed" ? "Agents complete" : "Agents need attention");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent build run failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function prepareDeployment() {
    if (!currentProjectId) {
      setError("Save or select a project before preparing deployment.");
      return;
    }

    setBusyAction("deploy");
    setStatus("Preparing deploy");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/deployments`, {
        method: "POST"
      });
      const payload = await readJsonResponse<{ deployment: EngineDeployment }>(response, "Deployment preparation failed");

      await refreshProjects();
      await Promise.all([refreshDeployments(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.deployment.status === "deployment_ready" ? "Deploy ready" : "Deploy blocked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deployment preparation failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function setupDatabase() {
    if (!currentProjectId) {
      setError("Save or select a project before setting up the generated database.");
      return;
    }

    setBusyAction("database");
    setStatus("Setting up DB");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/database`, {
        method: "POST"
      });
      const payload = await readJsonResponse<{ setup: EngineDatabaseSetup }>(response, "Database setup failed");

      await refreshProjects();
      await Promise.all([refreshDatabaseSetups(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.setup.status === "database_ready" ? "Database ready" : formatStatus(payload.setup.status));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Database setup failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function generateAppFiles() {
    if (!currentProjectId) {
      setError("Save or select a project before generating app files.");
      return;
    }

    setBusyAction("export");
    setStatus("Generating app");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/exports`, {
        method: "POST"
      });
      await readJsonResponse(response, "App export failed");

      await refreshProjects();
      await Promise.all([
        refreshExports(currentProjectId),
        refreshDatabaseSetups(currentProjectId),
        refreshReadiness(currentProjectId),
        loadSetupProfile(),
        loadHealth()
      ]);
      setStatus("App exported");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "App export failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function selectProject(projectId: string) {
    setCurrentProjectId(projectId);
    setAutopilotResult(null);
    setError("");
    await Promise.all([
      refreshRuns(projectId),
      refreshDeployments(projectId),
      refreshExports(projectId),
      refreshDatabaseSetups(projectId),
      refreshReadiness(projectId)
    ]);
  }

  async function loadHealth() {
    const response = await fetch("/api/engine/health");
    const payload = await response.json();

    if (response.ok) {
      setHealth(payload);
      setStorage(payload.storage || "local");
    }
  }

  async function loadSetupProfile() {
    const response = await fetch("/api/engine/setup-profile");
    const payload = await response.json();

    if (response.ok) {
      setSetupProfile(payload);
    }
  }

  async function loadAgentRoles() {
    const response = await fetch("/api/engine/agent-roles");
    const payload = await response.json();

    if (response.ok) {
      setAgentRoles(payload.roles || []);
    }
  }

  async function refreshProjects() {
    const response = await fetch("/api/engine/projects");
    const payload = await response.json();

    if (response.ok) {
      const projects = payload.projects || [];
      setSavedProjects(projects);
      setStorage(payload.storage || "neon");

      if (!currentProjectId && projects[0]?.id) {
        setCurrentProjectId(projects[0].id);
        await Promise.all([
          refreshRuns(projects[0].id),
          refreshDeployments(projects[0].id),
          refreshExports(projects[0].id),
          refreshDatabaseSetups(projects[0].id),
          refreshReadiness(projects[0].id)
        ]);
      }
    }
  }

  async function refreshRuns(projectId: string) {
    const response = await fetch(`/api/engine/projects/${projectId}/runs`);
    const payload = await response.json();

    if (response.ok) {
      setRuns(payload.runs || []);
      setStorage(payload.storage || "neon");
    }
  }

  async function refreshDeployments(projectId: string) {
    const response = await fetch(`/api/engine/projects/${projectId}/deployments`);
    const payload = await response.json();

    if (response.ok) {
      setDeployments(payload.deployments || []);
      setStorage(payload.storage || "neon");
    }
  }

  async function refreshExports(projectId: string) {
    const response = await fetch(`/api/engine/projects/${projectId}/exports`);
    const payload = await response.json();

    if (response.ok) {
      setExports(payload.exports || []);
      setStorage(payload.storage || "neon");
    }
  }

  async function refreshDatabaseSetups(projectId: string) {
    const response = await fetch(`/api/engine/projects/${projectId}/database`);
    const payload = await response.json();

    if (response.ok) {
      setDatabaseSetups(payload.setups || []);
      setStorage(payload.storage || "neon");
    }
  }

  async function refreshReadiness(projectId: string) {
    const response = await fetch(`/api/engine/projects/${projectId}/readiness`);
    const payload = await response.json();

    if (response.ok) {
      setReadinessReport(payload);
    }
  }

  function getIntakePayload() {
    return {
      idea: idea.trim(),
      targetCustomer: targetCustomer.trim() || undefined,
      problem: problem.trim() || undefined,
      revenueModel,
      appType
    };
  }

  function hasUsableIdea() {
    if (idea.trim().length >= 8) {
      return true;
    }

    setError("Add a short app description first.");
    setStatus("Needs attention");
    return false;
  }

  async function createProjectRecord() {
    const response = await fetch("/api/engine/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...getIntakePayload(),
        name: plan?.title
      })
    });
    const payload = await readJsonResponse<{ project: SavedProject; plan: Plan; storage?: string }>(response, "Project save failed");

    setStorage(payload.storage || "neon");
    setPlan(payload.plan);
    setCurrentProjectId(payload.project.id);
    setAutopilotResult(null);
    await refreshProjectWorkspace(payload.project.id);
    return payload;
  }

  async function refreshProjectWorkspace(projectId: string) {
    await refreshProjects();
    await Promise.all([
      refreshRuns(projectId),
      refreshDeployments(projectId),
      refreshExports(projectId),
      refreshDatabaseSetups(projectId),
      refreshReadiness(projectId),
      loadSetupProfile(),
      loadHealth()
    ]);
  }

  return (
    <div className="cockpit">
      <section className="panel cockpit-intake">
        <div>
          <p className="eyebrow">Automated Builder</p>
          <h1>Describe the app. The engine chooses the workflow.</h1>
          <p>
            The production cockpit calls the planner API, selects templates,
            prepares auth, assigns agents, and creates the QA path automatically.
          </p>
        </div>

        <form className="intake-form" onSubmit={(event) => {
          event.preventDefault();
          void startProjectBuild();
        }}>
          <div className="form-grid">
            <label>
              App description
              <textarea
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="A dream board that helps me stay focused, push through challenges, and choose long-term goals over short-term comfort."
              />
            </label>
            <label>
              Target customer
              <input
                value={targetCustomer}
                onChange={(event) => setTargetCustomer(event.target.value)}
                placeholder="Me first, then people trying to stay disciplined"
              />
            </label>
            <label>
              Problem
              <input
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="Hard moments make comfort feel easier than progress"
              />
            </label>
            <label>
              Revenue model
              <select value={revenueModel} onChange={(event) => setRevenueModel(event.target.value)}>
                <option>Not sure yet</option>
                <option>Free / personal project</option>
                <option>Free now, monetize later</option>
                <option>SaaS subscription</option>
                <option>Usage based</option>
                <option>Marketplace commission</option>
                <option>Lead generation</option>
                <option>Internal tool</option>
              </select>
            </label>
            <label>
              App type
              <select value={appType} onChange={(event) => setAppType(event.target.value)}>
                <option>Auto detect</option>
                <option>Personal productivity app</option>
                <option>SaaS customer portal</option>
                <option>Marketplace</option>
                <option>Internal operations tool</option>
                <option>AI workflow app</option>
              </select>
            </label>
          </div>

          <div className="action-row">
            <button className="button primary" type="submit" disabled={busy}>
              {busyAction === "start" ? "Building..." : "Start App Build"}
            </button>
            <button className="button" type="button" onClick={() => void analyze()} disabled={busy}>
              {busyAction === "plan" ? "Planning..." : "Preview Plan"}
            </button>
            <button className="button" type="button" onClick={saveProject} disabled={busy || !plan}>
            Save Project
          </button>
          <button className="button accent" type="button" onClick={runAutopilot} disabled={busy || !currentProjectId}>
            Run Autopilot
          </button>
          <button className="button" type="button" onClick={runAgents} disabled={busy || !currentProjectId}>
            Run Agents
          </button>
          <button className="button" type="button" onClick={generateAppFiles} disabled={busy || !currentProjectId}>
            Generate App
          </button>
          <button className="button" type="button" onClick={setupDatabase} disabled={busy || !currentProjectId || !latestExport}>
            Setup DB
          </button>
          <button className="button" type="button" onClick={runAutomation} disabled={busy || !currentProjectId}>
            Run QA Loop
          </button>
          <button className="button" type="button" onClick={prepareDeployment} disabled={busy || !currentProjectId}>
            Prepare Deploy
          </button>
          <button className="button" type="button" onClick={() => void refreshReadiness(currentProjectId)} disabled={busy || !currentProjectId}>
            Check Launch
          </button>
          <span className="status-chip">{status}</span>
          <span className="status-chip">{storage === "local" ? "Local storage" : "Neon storage"}</span>
            {error ? <span className="error-chip">{error}</span> : null}
          </div>
        </form>

        <div className={`workflow-feedback ${error ? "error" : ""}`} aria-live="polite">
          <strong>{error ? "Action needs attention" : status}</strong>
          <p>{error || getStatusDetails(status, storage, activeProject)}</p>
        </div>
      </section>

      <section className="panel factory-line-panel">
        <div className="factory-line-header">
          <div>
            <p className="eyebrow">Factory Line</p>
            <h2>{activeProject ? activeProject.name : "No project selected"}</h2>
            <p>
              Autopilot advances through the same stages as the manual controls, then records the next blocker or the deployment command path.
            </p>
          </div>
          <div className="factory-line-target">
            <span>Current output</span>
            <strong>{latestExport ? getExportLocation(latestExport) : "No bundle yet"}</strong>
          </div>
        </div>
        <div className="factory-stage-grid">
          {factoryStages.map((stage) => (
            <article className={`factory-stage ${stage.status}`} key={stage.label}>
              <span>{stage.status}</span>
              <strong>{stage.label}</strong>
              <p>{stage.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel health-panel">
        <div>
          <p className="eyebrow">Engine Health</p>
          <h2>{healthReady ? "Automation is production wired" : "Automation is running with setup gaps"}</h2>
          <p>
            {healthReady
              ? "Database, auth, admin, model workers, and deployment credentials are configured."
              : "The cockpit can plan, run agents, run QA, and prepare deployment locally. Connect the missing production pieces to unlock full execution."}
          </p>
        </div>
        <div className="health-grid">
          <HealthItem label="Database" ready={Boolean(health?.databaseConfigured && health.schemaReady)} />
          <HealthItem label="Auth" ready={Boolean(health?.authConfigured && health.adminConfigured)} />
          <HealthItem label={`Workers: ${health?.workerProvider || "local"}`} ready={Boolean(health?.workerConfigured)} />
          <HealthItem label="Deployment" ready={Boolean(health?.deploymentConfigured)} />
        </div>
        {health?.missing.length ? (
          <div className="missing-list">
            {health.missing.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </section>

      {agentRoles.length ? (
        <section className="panel agent-bench-panel">
          <div className="agent-bench-header">
            <div>
              <p className="eyebrow">Agent Bench</p>
              <h2>{agentRoles.length} specialists selected automatically</h2>
              <p>
                The engine routes the build through role-based agents, passes handoffs forward, and uses local workers until model keys are connected.
              </p>
            </div>
            <div className="agent-bench-summary">
              <span>Mode</span>
              <strong>{health?.workerProvider || "local"}</strong>
            </div>
          </div>
          <div className="agent-bench-grid">
            {agentRoles.map((role) => (
              <article className="agent-role-card" key={role.slug}>
                <span>{role.phase}</span>
                <strong>{role.name}</strong>
                <p>{role.purpose}</p>
                <div>
                  {role.deliverables.slice(0, 3).map((deliverable) => (
                    <small key={deliverable}>{deliverable}</small>
                  ))}
                </div>
                <em>{role.handoffTo.length ? `Hands off to ${role.handoffTo.join(", ")}` : "Final release gate"}</em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {setupProfile ? (
        <section className="panel setup-panel">
          <div className="setup-summary">
            <div>
              <p className="eyebrow">Setup Profile</p>
              <h2>{formatStatus(setupProfile.status)}</h2>
              <p>
                {setupProfile.status === "ready"
                  ? "All major setup phases are configured for automated runs."
                  : `${setupProfile.requiredMissing.length} required value${setupProfile.requiredMissing.length === 1 ? "" : "s"} still need setup.`}
              </p>
            </div>
            <div className="setup-next">
              <span>Next setup action</span>
              <strong>{setupProfile.nextAction}</strong>
            </div>
          </div>
          <div className="setup-phase-list">
            {setupPhases.map((phase) => (
              <article className={`setup-phase ${phase.status}`} key={phase.id}>
                <div>
                  <span>{formatStatus(phase.status)}</span>
                  <strong>{phase.title}</strong>
                </div>
                <p>{phase.details}</p>
                <div className="setup-variable-list">
                  {phase.variables.map((variable) => (
                    <span className={variable.present ? "present" : ""} key={variable.name} title={variable.label}>
                      {variable.name}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {readinessReport ? (
        <section className="panel readiness-panel">
          <div className="readiness-summary">
            <div>
              <p className="eyebrow">Launch Readiness</p>
              <h2>{formatStatus(readinessReport.status)}</h2>
              <p>
                {readinessBlockers.length
                  ? `${readinessBlockers.length} launch blocker${readinessBlockers.length === 1 ? "" : "s"} remain.`
                  : "The current project has cleared the launch checklist."}
              </p>
            </div>
            <div className="readiness-score">
              <span>{readinessReport.score}%</span>
              <strong>{readinessReport.nextAction}</strong>
            </div>
          </div>
          {autopilotResult ? (
            <div className="autopilot-log">
              <div>
                <span>Autopilot</span>
                <strong>{formatStatus(autopilotResult.status)}</strong>
              </div>
              {autopilotResult.steps.length ? (
                <div className="autopilot-steps">
                  {autopilotResult.steps.map((step, index) => (
                    <article className={`autopilot-step ${step.status}`} key={`${step.action}-${index}`}>
                      <span>{formatStatus(step.status)}</span>
                      <strong>{step.action}</strong>
                      <p>{step.details}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No autopilot steps were needed.</p>
              )}
            </div>
          ) : null}
          <div className="readiness-list">
            {readinessItems.map((item) => (
              <article className={`readiness-item ${item.status}`} key={item.id}>
                <span>{item.group}</span>
                <strong>{item.label}</strong>
                <p>{item.details}</p>
                <small>
                  {formatStatus(item.status)} - {item.evidence}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="metric-grid">
        <Metric label="Readiness" value={plan ? `${plan.readinessScore}%` : "0%"} />
        <Metric label="Templates" value={String(plan?.templates.length || 0)} />
        <Metric label="Agents" value={String(taskCounts.agents || agentRoles.length)} />
        <Metric label="Tasks" value={String(taskCounts.total || agentRoles.length)} />
      </section>

      {plan ? (
        <>
          <section className="grid">
            <article className="card">
              <p className="eyebrow">Recommended Stack</p>
              <h3>{plan.recommendedTarget}</h3>
              <p>{plan.stack.join(", ")}</p>
            </article>
            <article className="card">
              <p className="eyebrow">Authentication</p>
              <h3>{plan.auth.provider}</h3>
              <p>{plan.auth.roles.join(", ")} roles with protected account and admin routes.</p>
            </article>
            <article className="card">
              <p className="eyebrow">Value Proposition</p>
              <h3>{plan.appType}</h3>
              <p>{plan.valueProposition}</p>
            </article>
          </section>

          <section className="two-column">
            <article className="panel">
              <p className="eyebrow">Selected Templates</p>
              <h2>Reusable app modules</h2>
              <div className="template-list">
                {plan.templates.map((template) => (
                  <div className="template-item" key={template.id}>
                    <div>
                      <span>{template.category}</span>
                      <strong>{template.name}</strong>
                    </div>
                    <p>{template.description}</p>
                    <div>
                      {template.includes.map((item) => (
                        <span className="template-pill" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <p className="eyebrow">QA Loop</p>
              <h2>Readiness checks</h2>
              <div className="qa-list">
                {plan.qaChecks.map((check) => (
                  <div className="qa-item" key={check.title}>
                    <span>{check.severity}</span>
                    <div>
                      <strong>{check.title}</strong>
                      <p>{check.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel">
            <p className="eyebrow">Agent Workflow</p>
            <h2>Generated task graph</h2>
            <div className="task-list">
              {plan.tasks.map((task) => (
                <article className="task-item" key={`${task.agent}-${task.title}`}>
                  <span>
                    {task.phase} - {task.agent}
                  </span>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <small>
                    {task.priority} priority
                    {task.dependsOn.length ? ` - waits for ${task.dependsOn.join(", ")}` : " - starts immediately"}
                  </small>
                  {task.expectedArtifacts?.length ? <small>Artifacts: {task.expectedArtifacts.slice(0, 2).join(", ")}</small> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Persistence</p>
          <h2>Saved projects and QA runs</h2>
            {savedProjects.length ? (
              <div className="saved-project-list">
                {savedProjects.slice(0, 6).map((project) => (
                  <button
                    className={`saved-project ${project.id === currentProjectId ? "selected" : ""}`}
                    key={project.id}
                    type="button"
                    onClick={() => void selectProject(project.id)}
                  >
                    <span>{project.status}</span>
                    <strong>{project.name}</strong>
                    <p>
                      {project.app_type || "Planned app"} - {project.recommended_target || "Build target pending"}
                    </p>
                    <small>
                      {project.readiness_score}% readiness
                      {project.template_count ? ` - ${project.template_count} templates` : ""}
                      {project.task_count ? ` - ${project.task_count} tasks` : ""}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p>No saved projects yet. Save the current plan to persist it.</p>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Generated App</p>
            <h2>{latestExport ? "App bundle exported" : "No app bundle exported"}</h2>
            {latestExport ? (
              <div className="deployment-panel">
                <div>
                  <span>{latestExport.status || "generated_app_export"}</span>
                  <strong>{latestExport.file_count || getExportFiles(latestExport).length} files</strong>
                  <p>{latestExport.summary || getExportLocation(latestExport) || "Generated app bundle is stored as an artifact."}</p>
                </div>
                <pre className="artifact-preview">{getExportLocation(latestExport)}</pre>
                <pre className="artifact-preview">{getExportFiles(latestExport).slice(0, 18).join("\n")}</pre>
              </div>
            ) : (
              <p>Generate app files to create a concrete Next.js bundle from the current handoff manifest.</p>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Generated Database</p>
            <h2>{latestDatabaseSetup ? formatStatus(latestDatabaseSetup.status) : "No database setup run"}</h2>
            {latestDatabaseSetup ? (
              <div className="deployment-panel">
                <div>
                  <span>{latestDatabaseSetup.target}</span>
                  <strong>{formatStatus(latestDatabaseSetup.status)}</strong>
                  <p>{latestDatabaseSetup.details}</p>
                </div>
                <pre className="artifact-preview">
                  {[...getDatabaseSetupFiles(latestDatabaseSetup), ...getDatabaseSetupCommands(latestDatabaseSetup)].join("\n")}
                </pre>
              </div>
            ) : (
              <div>
                <p>Generate app files, add a per-app database URL to `.env.local`, then run Setup DB to apply schema and seed data.</p>
                {activeProject ? (
                  <pre className="artifact-preview">{getGeneratedDatabaseEnvKeys(activeProject).map((key) => `${key}="postgresql://..."`).join("\n")}</pre>
                ) : null}
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Deployment</p>
            <h2>{latestDeployment ? formatStatus(latestDeployment.status) : "No deployment prepared"}</h2>
            {latestDeployment ? (
              <div className="deployment-panel">
                <div>
                  <span>{latestDeployment.provider}</span>
                  <strong>{latestDeployment.environment}</strong>
                  <p>{getDeploymentDetails(latestDeployment)}</p>
                </div>
                {latestDeployment.url ? <a className="button" href={latestDeployment.url}>Open Deployment</a> : null}
                <pre className="artifact-preview">{getDeploymentCommands(latestDeployment).join("\n")}</pre>
              </div>
            ) : (
              <p>Prepare deployment after agents and QA have run to record the Vercel command path and any blockers.</p>
            )}
          </section>

          <section className="two-column">
            <article className="panel">
              <p className="eyebrow">Latest Run</p>
              <h2>{activeProject ? activeProject.name : "No project selected"}</h2>
              {latestRun ? (
                <>
                  <div className="run-summary">
                    <Metric label="Run status" value={formatStatus(latestRun.status)} />
                    <Metric label="Run readiness" value={`${getRunReadiness(latestRun)}%`} />
                    <Metric label="Agents done" value={String(latestRunAgents.length)} />
                    <Metric label="Findings" value={String(latestRunQaChecks.length)} />
                  </div>
                  <pre className="artifact-preview">{getRunArtifact(latestRun)?.content || "Run report is saved."}</pre>
                  {latestRunAgents.length ? (
                    <div className="agent-output-list">
                      {latestRunAgents.slice(0, 6).map((agent) => (
                        <article className="agent-output" key={agent.id || `${agent.agent}-${agent.task}`}>
                          <span>
                            {agent.phase || agent.agent}
                            {agent.provider ? ` - ${agent.provider}` : ""}
                          </span>
                          <strong>{agent.task}</strong>
                          <p>{agent.summary}</p>
                          {agent.structuredArtifacts?.length ? (
                            <small>
                              Usable output: {agent.structuredArtifacts.map((artifact) => `${artifact.title} (${artifact.kind})`).join(" | ")}
                            </small>
                          ) : null}
                          {agent.artifacts?.length ? <small>Artifact: {agent.artifacts[0]}</small> : null}
                          {agent.recommendations?.length ? (
                            <small>{agent.recommendations.slice(0, 2).join(" | ")}</small>
                          ) : null}
                          {agent.handoffs?.length ? <small>Handoff: {agent.handoffs[0]}</small> : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p>Select a saved project and run the QA loop to create agent runs, findings, and a report.</p>
              )}
            </article>

            <article className="panel">
              <p className="eyebrow">Run Findings</p>
              <h2>QA status</h2>
              {latestRunQaChecks.length ? (
                <div className="qa-list">
                  {latestRunQaChecks.map((check) => (
                    <div className="qa-item" key={check.id || check.title}>
                      <span className={check.status === "passed" ? "pass" : ""}>{formatStatus(check.status)}</span>
                      <div>
                        <strong>{check.title}</strong>
                        <p>{check.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No QA findings recorded yet.</p>
              )}
            </article>
          </section>
        </>
      ) : (
        <section className="panel empty-panel">
          <p className="eyebrow">Waiting</p>
          <h2>No plan generated yet</h2>
          <p>Run the analyzer to let the engine choose templates, auth, stack, agents, QA checks, and next actions.</p>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 180) };
    }
  }

  if (!response.ok) {
    const error = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : "";
    const hint = typeof payload === "object" && payload && "hint" in payload ? String((payload as { hint?: unknown }).hint) : "";
    throw new Error([error || `${fallbackMessage} (${response.status})`, hint].filter(Boolean).join(" "));
  }

  return payload as T;
}

function getStatusDetails(status: string, storage: string, activeProject: SavedProject | null) {
  if (status === "Ready") {
    return "Add an app idea, then start the build. Optional fields can stay blank when the description already covers them.";
  }

  if (status === "Planned") {
    return "Plan created. Save it or start the app build to let the engine create the project and run autopilot.";
  }

  if (status === "Saved") {
    return "Project saved. Autopilot can now run agents, generate files, prepare data, run QA, and check deployment blockers.";
  }

  if (status.includes("running") || status === "Creating project" || status === "Saving" || status === "Analyzing") {
    return "The engine is working on the request now.";
  }

  if (activeProject) {
    return `${activeProject.name} is selected with ${storage === "local" ? "local" : "Neon"} storage.`;
  }

  return `${storage === "local" ? "Local" : "Neon"} storage is active.`;
}

function HealthItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`health-item ${ready ? "ready" : ""}`}>
      <span>{label}</span>
      <strong>{ready ? "Ready" : "Setup"}</strong>
    </div>
  );
}

function getRunQaChecks(run: EngineRun | null) {
  return run?.qa_checks || run?.output?.qa_checks || [];
}

function getRunAgents(run: EngineRun | null) {
  return run?.agents || run?.output?.agents || [];
}

function getRunArtifact(run: EngineRun | null) {
  return run?.artifact || run?.output?.artifact || null;
}

function getRunReadiness(run: EngineRun | null) {
  return run?.readiness_score || run?.output?.readiness_score || 0;
}

function getDeploymentDetails(deployment: EngineDeployment) {
  return deployment.details || deployment.metadata?.details || "Deployment workflow is recorded.";
}

function getDeploymentCommands(deployment: EngineDeployment) {
  return deployment.commands || deployment.metadata?.commands || [];
}

function getExportFiles(generatedExport: EngineExport) {
  return generatedExport.manifest?.files || generatedExport.metadata?.files || [];
}

function getExportLocation(generatedExport: EngineExport) {
  return generatedExport.output_dir || generatedExport.uri || "Stored in engine artifacts";
}

function getDatabaseSetupFiles(setup: EngineDatabaseSetup) {
  const files = setup.applied_files || setup.metadata?.applied_files || [];

  return files.length ? files.map((file) => `applied: ${file}`) : [];
}

function getDatabaseSetupCommands(setup: EngineDatabaseSetup) {
  return setup.commands || setup.metadata?.commands || [];
}

function getGeneratedDatabaseEnvKeys(project: SavedProject) {
  const keys = [`GENERATED_APP_DATABASE_URL_${toEnvKeySuffix(project.id)}`];
  const nameKey = `GENERATED_APP_DATABASE_URL_${toEnvKeySuffix(project.name)}`;

  return keys.includes(nameKey) ? keys : [...keys, nameKey];
}

function toEnvKeySuffix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}
