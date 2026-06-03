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

const setupFiles = ["src/lib/db/schema.sql", "src/lib/db/seed.sql"];

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

    const payload = await buildDatabaseSetupPayload(projectId);
    const setup = await createLocalDatabaseSetup(projectId, payload);

    return {
      setup,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select id, readiness_score
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const payload = await buildDatabaseSetupPayload(projectId);
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

async function buildDatabaseSetupPayload(projectId: string): Promise<DatabaseSetupPayload> {
  const generatedExport = await getLatestGeneratedExport(projectId);
  const targetDatabaseUrl = getTargetDatabaseUrl();
  const target = targetDatabaseUrl ? describeDatabaseUrl(targetDatabaseUrl) : "Not configured";
  const commands = [
    "Generate App",
    "Set GENERATED_APP_DATABASE_URL to a Neon database or branch for this generated app",
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
      details: "Set GENERATED_APP_DATABASE_URL to the Neon database that should receive the generated app schema and seed data.",
      appliedFiles: [],
      commands,
      metadata: {
        exportId: generatedExport.exportId,
        outputDir: generatedExport.outputDir,
        missing: ["GENERATED_APP_DATABASE_URL"]
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
        outputDir: generatedExport.outputDir
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

function getTargetDatabaseUrl() {
  const targetUrl = process.env.GENERATED_APP_DATABASE_URL || process.env.APP_ENGINE_GENERATED_APP_DATABASE_URL;

  if (!targetUrl || targetUrl.includes("USER:PASSWORD@HOST")) {
    return "";
  }

  return targetUrl;
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
