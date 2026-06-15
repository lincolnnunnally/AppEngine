import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const authConfig = await importModule("src/lib/auth/config.ts");
const roles = await importModule("src/lib/auth/roles.ts");

assertEqual(
  authConfig.getAuthSecret({ NODE_ENV: "development" }),
  "app-engine-local-development-secret",
  "local development auth secret fallback"
);

assertEqual(
  authConfig.isUsingLocalDevelopmentAuthSecret({ NODE_ENV: "development" }),
  true,
  "local fallback is reported only outside production"
);

assertThrows(
  () => authConfig.getAuthSecret({ NODE_ENV: "production" }),
  "AUTH_SECRET is required in production",
  "production without AUTH_SECRET fails startup"
);

assertEqual(
  authConfig.getAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "configured-secret" }),
  "configured-secret",
  "production uses configured AUTH_SECRET"
);

assertEqual(
  await roles.resolveRoleForSessionUser(
    {
      id: "42",
      email: "owner@example.com",
      role: "customer"
    },
    {
      env: {
        APP_ENGINE_OWNER_EMAIL: "owner@example.com",
        DATABASE_URL: "postgres://preview.invalid/db"
      },
      sql: async () => [{ role: "admin" }]
    }
  ),
  "owner",
  "APP_ENGINE_OWNER_EMAIL remains owner override"
);

assertEqual(
  await roles.resolveRoleForSessionUser(
    {
      id: "42",
      email: "admin@example.com"
    },
    {
      env: {
        APP_ENGINE_OWNER_EMAIL: "owner@example.com",
        DATABASE_URL: "postgres://preview.invalid/db"
      },
      sql: async () => [{ role: "admin" }]
    }
  ),
  "admin",
  "database profile role is preserved"
);

assertEqual(
  await roles.resolveRoleForSessionUser(
    {
      email: "customer@example.com"
    },
    {
      env: {
        APP_ENGINE_OWNER_EMAIL: "owner@example.com"
      }
    }
  ),
  "customer",
  "unknown session users fall back to customer"
);

assertSourceIncludes("src/auth.ts", "secret: getAuthSecret()", "NextAuth uses guarded AUTH_SECRET helper");
assertSourceDoesNotInclude(
  "src/auth.ts",
  "app-engine-local-development-secret",
  "NextAuth config does not inline a hardcoded secret fallback"
);

for (const routePath of ["src/app/api/engine/health/route.ts", "src/app/api/engine/setup-profile/route.ts"]) {
  assertSourceIncludes(routePath, "canAccessEngineAdmin", `${routePath} requires engine admin access`);
  assertSourceIncludes(routePath, "Unauthorized", `${routePath} returns unauthorized when access fails`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[section] || {})) {
    assertDoesNotEqual(version, "latest", `${name} is not pinned to latest`);
    assertEqual(version, String(version).replace(/^[~^]/, ""), `${name} is exact-pinned`);
  }
}

assertEqual(packageJson.dependencies["next-auth"], "5.0.0-beta.31", "next-auth beta remains explicitly pinned");
assertSourceIncludes("README.md", "Do not float this dependency with `latest`", "next-auth upgrade policy is documented");

console.log("security hardening smoke ok");

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

function assertSourceIncludes(relativePath, expected, message) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

  if (!source.includes(expected)) {
    throw new Error(`${message}: expected ${relativePath} to include ${JSON.stringify(expected)}`);
  }
}

function assertSourceDoesNotInclude(relativePath, unexpected, message) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

  if (source.includes(unexpected)) {
    throw new Error(`${message}: did not expect ${relativePath} to include ${JSON.stringify(unexpected)}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertDoesNotEqual(actual, unexpected, message) {
  if (actual === unexpected) {
    throw new Error(`${message}: did not expect ${JSON.stringify(unexpected)}`);
  }
}

function assertThrows(fn, expectedMessage, message) {
  try {
    fn();
  } catch (caught) {
    const actualMessage = caught instanceof Error ? caught.message : String(caught);

    if (actualMessage.includes(expectedMessage)) {
      return;
    }

    throw new Error(`${message}: expected error to include ${JSON.stringify(expectedMessage)}, received ${JSON.stringify(actualMessage)}`);
  }

  throw new Error(`${message}: expected function to throw`);
}
