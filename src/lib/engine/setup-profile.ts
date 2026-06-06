import { getEngineHealth } from "./execution";

type SetupPhaseStatus = "ready" | "partial" | "missing";
type SetupVariableKind = "required" | "either" | "optional";

export type SetupVariable = {
  name: string;
  label: string;
  kind: SetupVariableKind;
  present: boolean;
};

export type SetupPhase = {
  id: string;
  title: string;
  status: SetupPhaseStatus;
  details: string;
  nextAction: string;
  variables: SetupVariable[];
};

export type EngineSetupProfile = {
  status: SetupPhaseStatus;
  nextAction: string;
  phases: SetupPhase[];
  requiredMissing: string[];
  generatedAt: string;
};

export async function getEngineSetupProfile(): Promise<EngineSetupProfile> {
  const health = await getEngineHealth();
  const phases = [
    createPhase({
      id: "engine-database",
      title: "Engine database",
      ready: health.databaseConfigured && health.schemaReady,
      partial: health.databaseConfigured,
      readyDetails: "The engine can persist projects, runs, QA, artifacts, and deployments in Neon.",
      partialDetails: "DATABASE_URL is present, but the engine schema still needs migration or connection attention.",
      missingDetails: "The engine is still using local JSON storage until DATABASE_URL is configured.",
      nextAction: health.databaseConfigured ? "Run npm run db:setup" : "Add DATABASE_URL",
      variables: [
        variable("DATABASE_URL", "Engine Neon database", "required"),
        variable("APP_ENGINE_LOCAL_MODE", "Local JSON fallback", "optional")
      ]
    }),
    createEitherPhase({
      id: "generated-databases",
      title: "Generated app databases",
      readyDetails: "The engine can provision a Neon branch for each generated app and apply schema/seed data.",
      fallbackDetails: "A global manual generated app database URL is enabled. Per-app database URLs or automatic Neon branches are still preferred.",
      missingDetails: "Generated apps need either Neon API branch provisioning or a per-app manual database URL after each project is created.",
      nextAction: "Add NEON_API_KEY and NEON_PROJECT_ID",
      primaryReady: hasEnv("NEON_API_KEY") && hasEnv("NEON_PROJECT_ID"),
      fallbackReady:
        process.env.APP_ENGINE_ALLOW_GLOBAL_GENERATED_DATABASE_URL === "true" &&
        (hasEnv("GENERATED_APP_DATABASE_URL") || hasEnv("APP_ENGINE_GENERATED_APP_DATABASE_URL")),
      variables: [
        variable("NEON_API_KEY", "Neon API key", "either"),
        variable("NEON_PROJECT_ID", "Neon project id", "either"),
        variable("NEON_PARENT_BRANCH_ID", "Parent branch", "optional"),
        variable("NEON_DATABASE_NAME", "Database name", "optional"),
        variable("NEON_ROLE_NAME", "Role name", "optional"),
        variable("GENERATED_APP_DATABASE_URL_<PROJECT_ID>", "Per-app manual database", "optional"),
        variable("GENERATED_APP_DATABASE_URL_<PROJECT_SLUG>", "Per-app manual database", "optional"),
        variable("APP_ENGINE_ALLOW_GLOBAL_GENERATED_DATABASE_URL", "Allow shared manual fallback", "optional")
      ]
    }),
    createPhase({
      id: "auth",
      title: "Customer and admin auth",
      ready: hasEnv("AUTH_SECRET") && hasEnv("APP_ENGINE_OWNER_EMAIL") && hasAuthProvider(),
      partial: hasEnv("AUTH_SECRET") && hasEnv("APP_ENGINE_OWNER_EMAIL"),
      readyDetails: "Auth secret, owner bootstrap email, and an OAuth provider are configured.",
      partialDetails: "Auth secret and owner email are configured. Add GitHub or Google OAuth before production sign-in.",
      missingDetails: "Customer/admin sign-in needs an auth secret and owner bootstrap email.",
      nextAction: getAuthNextAction(),
      variables: [
        variable("AUTH_SECRET", "Auth.js secret", "required"),
        variable("AUTH_URL", "Auth callback URL", "optional"),
        variable("APP_ENGINE_OWNER_EMAIL", "Owner/admin email", "required"),
        variable("AUTH_GITHUB_ID", "GitHub OAuth id", "optional"),
        variable("AUTH_GITHUB_SECRET", "GitHub OAuth secret", "optional"),
        variable("AUTH_GOOGLE_ID", "Google OAuth id", "optional"),
        variable("AUTH_GOOGLE_SECRET", "Google OAuth secret", "optional")
      ]
    }),
    createPhase({
      id: "model-workers",
      title: "Model workers",
      ready: health.workerProvider !== "local" && (hasEnv("OPENAI_API_KEY") || hasEnv("ANTHROPIC_API_KEY")),
      partial: health.workerProvider === "local" || hasEnv("OPENAI_API_KEY") || hasEnv("ANTHROPIC_API_KEY"),
      readyDetails: `Real worker automation is configured through ${health.workerProvider}.`,
      partialDetails: "Deterministic local workers are active for core engine development. Add a model provider when you are ready for real worker calls.",
      missingDetails: "The engine will use deterministic local workers until an OpenAI or Anthropic key is configured.",
      nextAction: health.workerProvider === "local" ? "Keep building locally or add OPENAI_API_KEY" : "Add OPENAI_API_KEY",
      variables: [
        variable("APP_ENGINE_WORKER_PROVIDER", "Worker provider override", "optional"),
        variable("OPENAI_API_KEY", "OpenAI worker key", "either"),
        variable("OPENAI_MODEL", "OpenAI model", "optional"),
        variable("ANTHROPIC_API_KEY", "Anthropic worker key", "either"),
        variable("ANTHROPIC_MODEL", "Anthropic model", "optional")
      ]
    }),
    createPhase({
      id: "deployment",
      title: "Vercel deployment",
      ready: health.deploymentConfigured,
      partial: hasEnv("VERCEL_TOKEN") || hasEnv("VERCEL_ORG_ID") || hasEnv("VERCEL_PROJECT_ID"),
      readyDetails: "Vercel preview deployment preparation is configured.",
      partialDetails: "Some Vercel deployment values are present, but deployment automation is not complete yet.",
      missingDetails: "Deployment can be prepared only after Vercel token, org, and project values are configured.",
      nextAction: "Add Vercel deployment variables",
      variables: [
        variable("VERCEL_TOKEN", "Vercel token", "required"),
        variable("VERCEL_ORG_ID", "Vercel org/team id", "required"),
        variable("VERCEL_PROJECT_ID", "Vercel project id", "required"),
        variable("VERCEL_TEAM_ID", "Vercel team id", "optional")
      ]
    })
  ];
  const requiredMissing = phases.flatMap((phase) =>
    phase.variables.filter((item) => item.kind === "required" && !item.present).map((item) => item.name)
  );
  const missingPhase = phases.find((phase) => phase.status === "missing");
  const partialPhase = phases.find((phase) => phase.status === "partial");

  return {
    status: missingPhase ? "missing" : partialPhase ? "partial" : "ready",
    nextAction: missingPhase?.nextAction || partialPhase?.nextAction || "Run Autopilot",
    phases,
    requiredMissing,
    generatedAt: new Date().toISOString()
  };
}

function createPhase(input: {
  id: string;
  title: string;
  ready: boolean;
  partial: boolean;
  readyDetails: string;
  partialDetails: string;
  missingDetails: string;
  nextAction: string;
  variables: SetupVariable[];
}): SetupPhase {
  const status = input.ready ? "ready" : input.partial ? "partial" : "missing";

  return {
    id: input.id,
    title: input.title,
    status,
    details: status === "ready" ? input.readyDetails : status === "partial" ? input.partialDetails : input.missingDetails,
    nextAction: status === "ready" ? "Complete" : input.nextAction,
    variables: input.variables
  };
}

function createEitherPhase(input: {
  id: string;
  title: string;
  primaryReady: boolean;
  fallbackReady: boolean;
  readyDetails: string;
  fallbackDetails: string;
  missingDetails: string;
  nextAction: string;
  variables: SetupVariable[];
}): SetupPhase {
  const status = input.primaryReady ? "ready" : input.fallbackReady ? "partial" : "missing";

  return {
    id: input.id,
    title: input.title,
    status,
    details: status === "ready" ? input.readyDetails : status === "partial" ? input.fallbackDetails : input.missingDetails,
    nextAction: status === "ready" ? "Complete" : input.nextAction,
    variables: input.variables
  };
}

function variable(name: string, label: string, kind: SetupVariableKind): SetupVariable {
  return {
    name,
    label,
    kind,
    present: hasEnv(name)
  };
}

function hasAuthProvider() {
  return (hasEnv("AUTH_GITHUB_ID") && hasEnv("AUTH_GITHUB_SECRET")) || (hasEnv("AUTH_GOOGLE_ID") && hasEnv("AUTH_GOOGLE_SECRET"));
}

function getAuthNextAction() {
  if (!hasEnv("AUTH_SECRET")) {
    return "Add AUTH_SECRET";
  }

  if (!hasEnv("APP_ENGINE_OWNER_EMAIL")) {
    return "Add APP_ENGINE_OWNER_EMAIL";
  }

  if (!hasAuthProvider()) {
    return "Add GitHub or Google OAuth";
  }

  return "Complete";
}

function hasEnv(name: string) {
  const value = process.env[name]?.trim();

  return Boolean(value && !value.includes("USER:PASSWORD@HOST") && !value.startsWith("replace-with"));
}
