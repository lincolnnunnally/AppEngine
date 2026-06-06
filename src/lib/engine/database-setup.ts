import { neon } from "@neondatabase/serverless";
import { getDatabase } from "@/lib/db/client";
import {
  createLocalDatabaseSetup,
  getLocalProject,
  listLocalDatabaseSetups,
  listLocalExports,
  type StoredDatabaseSetup
} from "./development-store";
import { isLocalMode } from "./local-mode";

type SetupStatus = "database_ready" | "database_blocked" | "database_failed";

type DatabaseSetupPayload = Omit<StoredDatabaseSetup, "id" | "project_id" | "created_at">;

type GeneratedExportLocation = {
  outputDir: string;
  exportId?: string;
};

type GeneratedDatabaseTarget = {
  databaseUrl: string;
  target: string;
  source: "manual_project" | "manual_global" | "neon_branch";
  metadata: Record<string, unknown>;
};

type NeonProvisionMetadata = {
  projectId: string;
  branchId: string;
  branchName: string;
  endpointId?: string;
  databaseName: string;
  roleName: string;
};

type NeonOperation = {
  id?: string;
  status?: string;
};

const setupFiles = ["src/lib/db/schema.sql", "src/lib/db/seed.sql"];
const neonApiBaseUrl = "https://console.neon.tech/api/v2";

export async function listProjectDatabaseSetups(projectId: string) {
  if (isLocalMode()) {
    return {
      setups: await listLocalDatabaseSetups(projectId),
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const artifacts = await sql`
    select id, project_id, title, content, uri, metadata, created_at
    from artifacts
    where project_id = ${projectId}
      and artifact_type = 'database_setup'
    order by created_at desc
    limit 12
  `;

  return {
    setups: artifacts.map((artifact) => normalizeDatabaseSetupArtifact(artifact)),
    storage: "neon" as const
  };
}

export async function setupGeneratedAppDatabase(projectId: string) {
  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const payload = await buildDatabaseSetupPayload(projectId, project.name);
    const setup = await createLocalDatabaseSetup(projectId, payload);

    return {
      setup,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select id, name, readiness_score
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const payload = await buildDatabaseSetupPayload(projectId, typeof project.name === "string" ? project.name : undefined);
  const [artifact] = await sql`
    insert into artifacts (project_id, artifact_type, title, content, uri, metadata)
    values (
      ${projectId},
      'database_setup',
      'Generated App Database Setup',
      ${payload.details},
      ${payload.target},
      ${JSON.stringify({
        status: payload.status,
        applied_files: payload.applied_files,
        commands: payload.commands,
        finished_at: payload.finished_at,
        ...payload.metadata
      })}
    )
    returning *
  `;

  await sql`
    update app_projects
    set status = ${payload.status},
      readiness_score = ${payload.status === "database_ready" ? Math.max(Number(project.readiness_score || 0), 90) : Number(project.readiness_score || 0)},
      updated_at = now()
    where id = ${projectId}
  `;

  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.database_setup', ${JSON.stringify({ setupId: artifact.id, status: payload.status })})
  `;

  return {
    setup: normalizeDatabaseSetupArtifact(artifact),
    storage: "neon" as const
  };
}

async function buildDatabaseSetupPayload(projectId: string, projectName?: string): Promise<DatabaseSetupPayload> {
  const generatedExport = await getLatestGeneratedExport(projectId);
  const targetResult = await getGeneratedDatabaseTarget(projectId, projectName);
  const targetDatabaseUrl = targetResult?.databaseUrl || "";
  const target = targetResult?.target || "Not configured";
  const manualEnvKeys = buildGeneratedAppDatabaseEnvKeys(projectId, projectName);
  const commands = [
    "Generate App",
    `Set ${manualEnvKeys[0]} for this generated app, or configure NEON_API_KEY and NEON_PROJECT_ID for automatic branches`,
    "Setup DB",
    "Run QA Loop",
    "Prepare Deploy"
  ];

  if (!generatedExport) {
    return createSetupPayload({
      status: "database_blocked",
      target,
      details: "Generate app files before running database setup.",
      appliedFiles: [],
      commands,
      metadata: {
        missing: ["Generated app export"]
      }
    });
  }

  if (!targetDatabaseUrl) {
    return createSetupPayload({
      status: "database_blocked",
      target,
      details:
        `Configure NEON_API_KEY and NEON_PROJECT_ID so the engine can create a Neon branch for each generated app, or set ${manualEnvKeys.join(" or ")} in .env.local for this generated app.`,
      appliedFiles: [],
      commands,
      metadata: {
        exportId: generatedExport.exportId,
        outputDir: generatedExport.outputDir,
        databaseEnvKeys: manualEnvKeys,
        missing: ["NEON_API_KEY", "NEON_PROJECT_ID", ...manualEnvKeys]
      }
    });
  }

  if (isSharedEngineDatabase(targetDatabaseUrl)) {
    return createSetupPayload({
      status: "database_blocked",
      target,
      details:
        "The generated app database target matches the engine DATABASE_URL. Use a separate Neon database/branch, or set APP_ENGINE_ALLOW_SHARED_DATABASE_TARGET=true if this is intentional.",
      appliedFiles: [],
      commands,
      metadata: {
        exportId: generatedExport.exportId,
        outputDir: generatedExport.outputDir,
        ...targetResult?.metadata,
        missing: ["Separate generated app database target"]
      }
    });
  }

  const targetSql = neon(targetDatabaseUrl);
  const appliedFiles: string[] = [];

  try {
    for (const file of setupFiles) {
      const contents = await readGeneratedSetupFile(generatedExport.outputDir, file);

      await targetSql.query(contents);
      appliedFiles.push(file);
    }

    return createSetupPayload({
      status: "database_ready",
      target,
      details: "Generated app schema and seed data were applied to the target Neon database.",
      appliedFiles,
      commands,
      metadata: {
        exportId: generatedExport.exportId,
        outputDir: generatedExport.outputDir,
        source: targetResult?.source,
        ...targetResult?.metadata
      }
    });
  } catch (caught) {
    return createSetupPayload({
      status: "database_failed",
      target,
      details: caught instanceof Error ? caught.message : "Database setup failed while applying generated SQL.",
      appliedFiles,
      commands,
      metadata: {
        exportId: generatedExport.exportId,
        outputDir: generatedExport.outputDir,
        source: targetResult?.source,
        ...targetResult?.metadata,
        failedFiles: setupFiles.filter((file) => !appliedFiles.includes(file))
      }
    });
  }
}

async function readGeneratedSetupFile(outputDir: string, file: string) {
  const { readFile } = await import("node:fs/promises");

  return readFile(`${outputDir}/${file}`, "utf8");
}

async function getLatestGeneratedExport(projectId: string): Promise<GeneratedExportLocation | null> {
  if (isLocalMode()) {
    const [latestExport] = await listLocalExports(projectId);

    if (!latestExport?.output_dir) {
      return null;
    }

    return {
      outputDir: latestExport.output_dir,
      exportId: latestExport.id
    };
  }

  const sql = getDatabase();
  const [artifact] = await sql`
    select id, uri
    from artifacts
    where project_id = ${projectId}
      and artifact_type = 'generated_app_export'
      and uri is not null
    order by created_at desc
    limit 1
  `;

  if (!artifact?.uri) {
    return null;
  }

  return {
    outputDir: String(artifact.uri),
    exportId: String(artifact.id)
  };
}

function createSetupPayload(input: {
  status: SetupStatus;
  target: string;
  details: string;
  appliedFiles: string[];
  commands: string[];
  metadata?: Record<string, unknown>;
}): DatabaseSetupPayload {
  return {
    status: input.status,
    target: input.target,
    details: input.details,
    applied_files: input.appliedFiles,
    commands: input.commands,
    metadata: input.metadata,
    finished_at: new Date().toISOString()
  };
}

async function getGeneratedDatabaseTarget(projectId: string, projectName?: string): Promise<GeneratedDatabaseTarget | null> {
  const manualTarget = getProjectManualTargetDatabaseUrl(projectId, projectName);

  if (manualTarget) {
    return {
      databaseUrl: manualTarget.databaseUrl,
      target: describeDatabaseUrl(manualTarget.databaseUrl),
      source: manualTarget.source,
      metadata: {
        targetSource: manualTarget.key,
        databaseEnvKeys: buildGeneratedAppDatabaseEnvKeys(projectId, projectName)
      }
    };
  }

  if (!process.env.NEON_API_KEY || !process.env.NEON_PROJECT_ID) {
    return null;
  }

  const neonTarget = await getOrCreateNeonBranchTarget(projectId, projectName);

  return neonTarget;
}

export function buildGeneratedAppDatabaseEnvKeys(projectId: string, projectName?: string) {
  const keys = [`GENERATED_APP_DATABASE_URL_${toEnvKeySuffix(projectId)}`];
  const nameSuffix = projectName ? toEnvKeySuffix(projectName) : "";

  if (nameSuffix && !keys.includes(`GENERATED_APP_DATABASE_URL_${nameSuffix}`)) {
    keys.push(`GENERATED_APP_DATABASE_URL_${nameSuffix}`);
  }

  return keys;
}

function getProjectManualTargetDatabaseUrl(projectId: string, projectName?: string) {
  for (const key of buildGeneratedAppDatabaseEnvKeys(projectId, projectName)) {
    const databaseUrl = usableDatabaseUrl(process.env[key]);

    if (databaseUrl) {
      return { key, databaseUrl, source: "manual_project" as const };
    }
  }

  const globalDatabaseUrl = usableDatabaseUrl(process.env.GENERATED_APP_DATABASE_URL || process.env.APP_ENGINE_GENERATED_APP_DATABASE_URL);

  if (globalDatabaseUrl && process.env.APP_ENGINE_ALLOW_GLOBAL_GENERATED_DATABASE_URL === "true") {
    return {
      key: process.env.GENERATED_APP_DATABASE_URL ? "GENERATED_APP_DATABASE_URL" : "APP_ENGINE_GENERATED_APP_DATABASE_URL",
      databaseUrl: globalDatabaseUrl,
      source: "manual_global" as const
    };
  }

  return null;
}

function usableDatabaseUrl(value?: string) {
  const databaseUrl = value?.trim();

  if (!databaseUrl || databaseUrl.includes("USER:PASSWORD@HOST") || databaseUrl.startsWith("replace-with")) {
    return "";
  }

  return /^postgres(?:ql)?:\/\//.test(databaseUrl) ? databaseUrl : "";
}

function toEnvKeySuffix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function getOrCreateNeonBranchTarget(projectId: string, projectName?: string): Promise<GeneratedDatabaseTarget> {
  const reusedTarget = await getReusableNeonProvision(projectId);
  const provision = reusedTarget || (await createGeneratedAppNeonBranch(projectId, projectName));
  const databaseUrl = await getNeonConnectionUri(provision);

  return {
    databaseUrl,
    target: describeDatabaseUrl(databaseUrl),
    source: "neon_branch",
    metadata: {
      targetSource: reusedTarget ? "existing_neon_branch" : "new_neon_branch",
      neon: provision
    }
  };
}

async function getReusableNeonProvision(projectId: string): Promise<NeonProvisionMetadata | null> {
  const { setups } = await listProjectDatabaseSetups(projectId);

  for (const setup of setups) {
    const metadata = isRecord(setup.metadata) ? setup.metadata : {};
    const neonMetadata = isRecord(metadata.neon) ? metadata.neon : null;

    if (
      neonMetadata &&
      typeof neonMetadata.projectId === "string" &&
      typeof neonMetadata.branchId === "string" &&
      typeof neonMetadata.branchName === "string" &&
      typeof neonMetadata.databaseName === "string" &&
      typeof neonMetadata.roleName === "string"
    ) {
      return {
        projectId: neonMetadata.projectId,
        branchId: neonMetadata.branchId,
        branchName: neonMetadata.branchName,
        endpointId: typeof neonMetadata.endpointId === "string" ? neonMetadata.endpointId : undefined,
        databaseName: neonMetadata.databaseName,
        roleName: neonMetadata.roleName
      };
    }
  }

  return null;
}

async function createGeneratedAppNeonBranch(projectId: string, projectName?: string): Promise<NeonProvisionMetadata> {
  const neonProjectId = process.env.NEON_PROJECT_ID || "";
  const databaseName = process.env.NEON_DATABASE_NAME || "neondb";
  const roleName = process.env.NEON_ROLE_NAME || "neondb_owner";
  const branchName = buildGeneratedBranchName(projectId, projectName);
  const body: Record<string, unknown> = {
    branch: {
      name: branchName
    },
    endpoints: [
      {
        type: "read_write"
      }
    ]
  };

  if (process.env.NEON_PARENT_BRANCH_ID) {
    body.branch = {
      ...(body.branch as Record<string, unknown>),
      parent_id: process.env.NEON_PARENT_BRANCH_ID
    };
  }

  const result = await neonApiRequest<{
    branch?: {
      id?: string;
      name?: string;
    };
    endpoints?: Array<{
      id?: string;
      type?: string;
    }>;
    operations?: NeonOperation[];
  }>(`/projects/${encodeURIComponent(neonProjectId)}/branches`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  const branchId = result.branch?.id;
  const endpointId = result.endpoints?.find((endpoint) => endpoint.type === "read_write")?.id || result.endpoints?.[0]?.id;

  if (!branchId) {
    throw new Error("Neon branch creation did not return a branch id.");
  }

  await pollNeonOperations(neonProjectId, result.operations || []);

  return {
    projectId: neonProjectId,
    branchId,
    branchName: result.branch?.name || branchName,
    endpointId,
    databaseName,
    roleName
  };
}

async function getNeonConnectionUri(provision: NeonProvisionMetadata) {
  const params = new URLSearchParams({
    branch_id: provision.branchId,
    database_name: provision.databaseName,
    role_name: provision.roleName
  });

  if (provision.endpointId) {
    params.set("endpoint_id", provision.endpointId);
  }

  if (process.env.NEON_USE_POOLED_CONNECTION === "true") {
    params.set("pooled", "true");
  }

  const result = await neonApiRequest<{ uri?: string }>(
    `/projects/${encodeURIComponent(provision.projectId)}/connection_uri?${params.toString()}`
  );

  if (!result.uri) {
    throw new Error("Neon did not return a generated app database connection URI.");
  }

  return result.uri;
}

async function pollNeonOperations(projectId: string, operations: NeonOperation[]) {
  const operationIds = operations.map((operation) => operation.id).filter((id): id is string => Boolean(id));

  for (const operationId of operationIds) {
    await waitForNeonOperation(projectId, operationId);
  }
}

async function waitForNeonOperation(projectId: string, operationId: string) {
  let lastStatus = "";

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await neonApiRequest<{ operation?: NeonOperation }>(
      `/projects/${encodeURIComponent(projectId)}/operations/${encodeURIComponent(operationId)}`
    );
    const status = result.operation?.status || "";
    lastStatus = status;

    if (status === "finished" || status === "skipped") {
      return;
    }

    if (status === "cancelled" || status === "cancelling") {
      throw new Error(`Neon operation ${operationId} ended with status ${status}.`);
    }

    await delay(1500);
  }

  throw new Error(`Timed out waiting for Neon operation ${operationId}${lastStatus ? ` (${lastStatus})` : ""}.`);
}

async function neonApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${neonApiBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${process.env.NEON_API_KEY}`,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(`Neon API request failed (${response.status}): ${details || response.statusText}`);
  }

  return (await response.json()) as T;
}

function buildGeneratedBranchName(projectId: string, projectName?: string) {
  const prefix = process.env.NEON_GENERATED_APP_BRANCH_PREFIX || "app-engine-generated";
  const projectSlug = slugify(projectName || projectId).slice(0, 36) || "app";
  const shortId = projectId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || Date.now().toString(36);

  return `${prefix}-${projectSlug}-${shortId}`.slice(0, 63);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSharedEngineDatabase(targetDatabaseUrl: string) {
  const engineDatabaseUrl = process.env.DATABASE_URL;

  return (
    Boolean(engineDatabaseUrl) &&
    targetDatabaseUrl.trim() === engineDatabaseUrl?.trim() &&
    process.env.APP_ENGINE_ALLOW_SHARED_DATABASE_TARGET !== "true"
  );
}

function describeDatabaseUrl(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "Configured Neon database";
  }
}

function normalizeDatabaseSetupArtifact(artifact: Record<string, unknown>) {
  const metadata = isRecord(artifact.metadata) ? artifact.metadata : {};

  return {
    id: String(artifact.id || ""),
    project_id: String(artifact.project_id || ""),
    status: typeof metadata.status === "string" ? metadata.status : "database_setup",
    target: typeof artifact.uri === "string" ? artifact.uri : typeof metadata.target === "string" ? metadata.target : "Unknown target",
    details: typeof artifact.content === "string" ? artifact.content : "Database setup was recorded.",
    applied_files: Array.isArray(metadata.applied_files) ? metadata.applied_files.map(String) : [],
    commands: Array.isArray(metadata.commands) ? metadata.commands.map(String) : [],
    metadata,
    created_at: normalizeDateValue(artifact.created_at),
    finished_at: typeof metadata.finished_at === "string" ? metadata.finished_at : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" ? value : new Date().toISOString();
}
