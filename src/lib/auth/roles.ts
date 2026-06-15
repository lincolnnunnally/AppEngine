import { neon } from "@neondatabase/serverless";

export const roles = ["owner", "admin", "customer", "vendor"] as const;

export type Role = (typeof roles)[number];

type RuntimeEnv = Record<string, string | undefined>;

type SessionRoleUser = {
  id?: unknown;
  email?: string | null;
  role?: unknown;
};

type RoleResolverOptions = {
  env?: RuntimeEnv;
  sql?: ReturnType<typeof neon>;
};

const databaseUrlEnvKeys = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "NEON_DATABASE_URL"] as const;

export function canAccessAdmin(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canAccessCustomerArea(role?: string | null) {
  return role === "owner" || role === "admin" || role === "customer" || role === "vendor";
}

export function roleForEmail(email?: string | null, env: RuntimeEnv = process.env): Role {
  return isOwnerEmail(email, env) ? "owner" : "customer";
}

export async function resolveRoleForSessionUser(
  user?: SessionRoleUser | null,
  options: RoleResolverOptions = {}
): Promise<Role> {
  const env = options.env || process.env;

  if (isOwnerEmail(user?.email, env)) {
    return "owner";
  }

  const userRole = normalizeRole(user?.role);

  if (userRole) {
    return userRole;
  }

  const databaseRole = await readDatabaseProfileRole(user, {
    ...options,
    env
  });

  return databaseRole || "customer";
}

export function normalizeRole(value: unknown): Role | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  return (roles as readonly string[]).includes(normalized) ? (normalized as Role) : undefined;
}

function isOwnerEmail(email?: string | null, env: RuntimeEnv = process.env) {
  const normalizedEmail = email?.trim().toLowerCase();
  const ownerEmail = env.APP_ENGINE_OWNER_EMAIL?.trim().toLowerCase();

  return Boolean(normalizedEmail && ownerEmail && normalizedEmail === ownerEmail);
}

async function readDatabaseProfileRole(
  user?: SessionRoleUser | null,
  options: RoleResolverOptions = {}
): Promise<Role | undefined> {
  const authUserId = getNumericAuthUserId(user?.id);
  const email = user?.email?.trim();

  if (!authUserId && !email) {
    return undefined;
  }

  const sql = options.sql || getProfileRoleSql(options.env || process.env);

  if (!sql) {
    return undefined;
  }

  try {
    if (authUserId) {
      const rows = await sql`
        select role
        from app_user_profiles
        where auth_user_id = ${authUserId}
        limit 1
      `;

      const role = normalizeRole((rows as Array<{ role?: unknown }>)[0]?.role);

      if (role) {
        return role;
      }
    }

    if (email) {
      const rows = await sql`
        select app_user_profiles.role
        from app_user_profiles
        join users on users.id = app_user_profiles.auth_user_id
        where lower(users.email) = lower(${email})
        limit 1
      `;

      return normalizeRole((rows as Array<{ role?: unknown }>)[0]?.role);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getProfileRoleSql(env: RuntimeEnv) {
  const databaseUrl = getConfiguredRoleDatabaseUrl(env);

  return databaseUrl ? neon(databaseUrl) : undefined;
}

function getConfiguredRoleDatabaseUrl(env: RuntimeEnv) {
  for (const key of databaseUrlEnvKeys) {
    const value = env[key]?.trim();

    if (value && !value.includes("USER:PASSWORD@HOST") && !value.startsWith("replace-with") && /^postgres(?:ql)?:\/\//i.test(value)) {
      return value;
    }
  }

  return undefined;
}

function getNumericAuthUserId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return undefined;
}
