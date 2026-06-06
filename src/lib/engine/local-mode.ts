const databaseUrlEnvKeys = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "NEON_DATABASE_URL"] as const;

type RuntimeEnv = Record<string, string | undefined>;

export function isLocalMode(env: RuntimeEnv = process.env) {
  const hasDatabase = Boolean(getConfiguredDatabaseUrl(env));

  if (isVercelRuntime(env)) {
    return !hasDatabase;
  }

  return env.APP_ENGINE_LOCAL_MODE === "true" || !hasDatabase;
}

export function getConfiguredDatabaseUrl(env: RuntimeEnv = process.env) {
  for (const key of databaseUrlEnvKeys) {
    const value = env[key]?.trim();

    if (isUsablePostgresUrl(value)) {
      return value;
    }
  }

  return undefined;
}

export function getConfiguredDatabaseEnvKey(env: RuntimeEnv = process.env) {
  return databaseUrlEnvKeys.find((key) => isUsablePostgresUrl(env[key]));
}

export function getDatabaseUrlEnvKeys() {
  return [...databaseUrlEnvKeys];
}

export function isUsableDatabaseUrl(value = getConfiguredDatabaseUrl()) {
  return isUsablePostgresUrl(value);
}

function isUsablePostgresUrl(value?: string) {
  const databaseUrl = value?.trim();

  return Boolean(
    databaseUrl &&
      !databaseUrl.includes("USER:PASSWORD@HOST") &&
      !databaseUrl.startsWith("replace-with") &&
      /^postgres(?:ql)?:\/\//i.test(databaseUrl)
  );
}

function isVercelRuntime(env: RuntimeEnv) {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
}
