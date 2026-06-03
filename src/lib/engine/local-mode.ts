export function isLocalMode() {
  const databaseUrl = process.env.DATABASE_URL;

  return (
    process.env.APP_ENGINE_LOCAL_MODE === "true" ||
    !databaseUrl ||
    databaseUrl.includes("USER:PASSWORD@HOST")
  );
}
