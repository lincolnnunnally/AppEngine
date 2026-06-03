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
  title: string;
  description: string;
  dependsOn: string[];
  priority: string;
  status: string;
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
    task: string;
    status: string;
    summary: string;
    provider?: string;
    recommendations?: string[];
    artifacts?: string[];
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

const starterIdea =
  "A multi-agent app-building engine that takes an idea, improves it for the target customer, creates customer/admin auth, builds the app, runs QA, fixes issues, and deploys to Vercel with Neon.";

export function AppEngineCockpit() {
  const [idea, setIdea] = useState(starterIdea);
  const [targetCustomer, setTargetCustomer] = useState("Founders and builders who need finished apps");
  const [problem, setProblem] = useState("Prototype tools stop before auth, QA, database, and deployment are complete");
  const [revenueModel, setRevenueModel] = useState("SaaS subscription");
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
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [storage, setStorage] = useState("local");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadHealth();
    void loadSetupProfile();
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
  const healthReady =
    health?.schemaReady && health.authConfigured && health.adminConfigured && health.workerConfigured && health.deploymentConfigured;

  const taskCounts = useMemo(() => {
    const tasks = plan?.tasks || [];
    return {
      total: tasks.length,
      high: tasks.filter((task) => task.priority === "high").length,
      agents: new Set(tasks.map((task) => task.agent)).size
    };
  }, [plan]);

  async function analyze() {
    setStatus("Analyzing");
    setError("");

    try {
      const response = await fetch("/api/engine/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea,
          targetCustomer,
          problem,
          revenueModel,
          appType
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analyzer failed");
      }

      setPlan(payload);
      setStatus("Planned");
      await refreshProjects();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analyzer failed");
      setStatus("Needs attention");
    }
  }

  async function saveProject() {
    setStatus("Saving");
    setError("");

    try {
      const response = await fetch("/api/engine/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea,
          name: plan?.title,
          targetCustomer,
          problem,
          revenueModel,
          appType
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Project save failed");
      }

      setStorage(payload.storage || "neon");
      setPlan(payload.plan);
      setCurrentProjectId(payload.project.id);
      setAutopilotResult(null);
      await refreshProjects();
      await Promise.all([
        refreshRuns(payload.project.id),
        refreshDeployments(payload.project.id),
        refreshExports(payload.project.id),
        refreshDatabaseSetups(payload.project.id),
        refreshReadiness(payload.project.id),
        loadSetupProfile()
      ]);
      setStatus("Saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project save failed");
      setStatus("Needs attention");
    }
  }

  async function runAutopilot() {
    if (!currentProjectId) {
      setError("Save or select a project before running autopilot.");
      return;
    }

    setStatus("Autopilot running");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/autopilot`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Autopilot failed");
      }

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
    }
  }

  async function runAutomation() {
    if (!currentProjectId) {
      setError("Save or select a project before running QA.");
      return;
    }

    setStatus("Running QA");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/runs`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Automation run failed");
      }

      await refreshProjects();
      await Promise.all([refreshRuns(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.run.status === "qa_passed" ? "QA passed" : "QA needs attention");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automation run failed");
      setStatus("Needs attention");
    }
  }

  async function runAgents() {
    if (!currentProjectId) {
      setError("Save or select a project before running agents.");
      return;
    }

    setStatus("Running agents");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/agents`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Agent build run failed");
      }

      await refreshProjects();
      await Promise.all([refreshRuns(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.run.status === "agents_completed" ? "Agents complete" : "Agents need attention");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent build run failed");
      setStatus("Needs attention");
    }
  }

  async function prepareDeployment() {
    if (!currentProjectId) {
      setError("Save or select a project before preparing deployment.");
      return;
    }

    setStatus("Preparing deploy");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/deployments`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Deployment preparation failed");
      }

      await refreshProjects();
      await Promise.all([refreshDeployments(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.deployment.status === "deployment_ready" ? "Deploy ready" : "Deploy blocked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deployment preparation failed");
      setStatus("Needs attention");
    }
  }

  async function setupDatabase() {
    if (!currentProjectId) {
      setError("Save or select a project before setting up the generated database.");
      return;
    }

    setStatus("Setting up DB");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/database`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Database setup failed");
      }

      await refreshProjects();
      await Promise.all([refreshDatabaseSetups(currentProjectId), refreshReadiness(currentProjectId), loadSetupProfile(), loadHealth()]);
      setStatus(payload.setup.status === "database_ready" ? "Database ready" : formatStatus(payload.setup.status));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Database setup failed");
      setStatus("Needs attention");
    }
  }

  async function generateAppFiles() {
    if (!currentProjectId) {
      setError("Save or select a project before generating app files.");
      return;
    }

    setStatus("Generating app");
    setError("");

    try {
      const response = await fetch(`/api/engine/projects/${currentProjectId}/exports`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "App export failed");
      }

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

        <div className="form-grid">
          <label>
            App idea
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} />
          </label>
          <label>
            Target customer
            <input value={targetCustomer} onChange={(event) => setTargetCustomer(event.target.value)} />
          </label>
          <label>
            Problem
            <input value={problem} onChange={(event) => setProblem(event.target.value)} />
          </label>
          <label>
            Revenue model
            <select value={revenueModel} onChange={(event) => setRevenueModel(event.target.value)}>
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
              <option>SaaS customer portal</option>
              <option>Marketplace</option>
              <option>Internal operations tool</option>
              <option>AI workflow app</option>
            </select>
          </label>
        </div>

        <div className="action-row">
          <button className="button primary" type="button" onClick={analyze}>
            Analyze And Plan
          </button>
          <button className="button" type="button" onClick={saveProject} disabled={!plan}>
            Save Project
          </button>
          <button className="button accent" type="button" onClick={runAutopilot} disabled={!currentProjectId}>
            Run Autopilot
          </button>
          <button className="button" type="button" onClick={runAgents} disabled={!currentProjectId}>
            Run Agents
          </button>
          <button className="button" type="button" onClick={generateAppFiles} disabled={!currentProjectId}>
            Generate App
          </button>
          <button className="button" type="button" onClick={setupDatabase} disabled={!currentProjectId || !latestExport}>
            Setup DB
          </button>
          <button className="button" type="button" onClick={runAutomation} disabled={!currentProjectId}>
            Run QA Loop
          </button>
          <button className="button" type="button" onClick={prepareDeployment} disabled={!currentProjectId}>
            Prepare Deploy
          </button>
          <button className="button" type="button" onClick={() => void refreshReadiness(currentProjectId)} disabled={!currentProjectId}>
            Check Launch
          </button>
          <span className="status-chip">{status}</span>
          <span className="status-chip">{storage === "local" ? "Local storage" : "Neon storage"}</span>
          {error ? <span className="error-chip">{error}</span> : null}
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
        <Metric label="Agents" value={String(taskCounts.agents)} />
        <Metric label="Tasks" value={String(taskCounts.total)} />
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
                  <span>{task.agent}</span>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <small>
                    {task.priority} priority
                    {task.dependsOn.length ? ` - waits for ${task.dependsOn.join(", ")}` : " - starts immediately"}
                  </small>
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
                  <p>{latestExport.summary || latestExport.uri || "Generated app bundle is stored as an artifact."}</p>
                </div>
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
              <p>Generate app files, set GENERATED_APP_DATABASE_URL, then run Setup DB to apply schema and seed data.</p>
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
                            {agent.agent}
                            {agent.provider ? ` - ${agent.provider}` : ""}
                          </span>
                          <strong>{agent.task}</strong>
                          <p>{agent.summary}</p>
                          {agent.recommendations?.length ? (
                            <small>{agent.recommendations.slice(0, 2).join(" | ")}</small>
                          ) : null}
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

function getDatabaseSetupFiles(setup: EngineDatabaseSetup) {
  const files = setup.applied_files || setup.metadata?.applied_files || [];

  return files.length ? files.map((file) => `applied: ${file}`) : [];
}

function getDatabaseSetupCommands(setup: EngineDatabaseSetup) {
  return setup.commands || setup.metadata?.commands || [];
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}
