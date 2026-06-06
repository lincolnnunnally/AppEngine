export function isLocalMode() {
  return process.env.APP_ENGINE_LOCAL_MODE === "true" || !isUsableDatabaseUrl();
}

export function isUsableDatabaseUrl(value = process.env.DATABASE_URL) {
  const databaseUrl = value?.trim();

  return Boolean(databaseUrl && !databaseUrl.includes("USER:PASSWORD@HOST") && /^postgres(?:ql)?:\/\//.test(databaseUrl));
}
