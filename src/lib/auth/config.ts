type RuntimeEnv = Record<string, string | undefined>;

const localDevelopmentAuthSecret = "app-engine-local-development-secret";

export function getAuthSecret(env: RuntimeEnv = process.env) {
  const configuredSecret = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (env.NODE_ENV !== "production") {
    return localDevelopmentAuthSecret;
  }

  throw new Error("AUTH_SECRET is required in production. Configure it in the deployment environment.");
}

export function isUsingLocalDevelopmentAuthSecret(env: RuntimeEnv = process.env) {
  return !env.AUTH_SECRET?.trim() && !env.NEXTAUTH_SECRET?.trim() && env.NODE_ENV !== "production";
}
