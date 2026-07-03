import { neon } from "@neondatabase/serverless";

export const roles = ["owner", "admin", "customer", "vendor"] as const;

export type Role = (typeof roles)[number];

// Staged go-public control (Step 6). The consumer surface (two-door entry +
// problem/opportunity intakes + their POST APIs) opens in three rungs:
//   owner     — closed to non-owners (DEFAULT; identical to pre-Step-6 behavior)
//   allowlist — controlled real users: only approved customer emails get in
//   public    — open: any signed-in customer reaches the consumer surface
// Operator screens stay owner/admin-only in every mode. The mode is set by
// APP_ENGINE_PUBLIC_ACCESS and defaults to "owner" (fail closed), so merging the
// machinery changes nothing live — Lincoln flips the env var to open the doors.
export const publicAccessModes = ["owner", "allowlist", "public"] as const;

export type PublicAccessMode = (typeof publicAccessModes)[number];

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

export function canAccessOwner(role?: string | null) {
  return role === "owner";
}

export function canAccessCustomerArea(role?: string | null) {
  return role === "owner" || role === "admin" || role === "customer" || role === "vendor";
}

export function getPublicAccessMode(env: RuntimeEnv = process.env): PublicAccessMode {
  const raw = env.APP_ENGINE_PUBLIC_ACCESS?.trim().toLowerCase();

  // Unknown/blank values fail closed to owner-only.
  return (publicAccessModes as readonly string[]).includes(raw ?? "") ? (raw as PublicAccessMode) : "owner";
}

export function parseCustomerAllowlist(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isCustomerAllowlisted(email?: string | null, env: RuntimeEnv = process.env): boolean {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return parseCustomerAllowlist(env.APP_ENGINE_CUSTOMER_ALLOWLIST).includes(normalizedEmail);
}

// Pure decision used by the consumer-surface gate. Owner/admin operators always
// pass; non-operators are gated by the staged public-access mode. Default
// ("owner") closes the surface to everyone but operators — no live change.
export function canAccessConsumerSurfaceForRole(
  role?: string | null,
  email?: string | null,
  env: RuntimeEnv = process.env
): boolean {
  if (canAccessAdmin(role)) {
    return true;
  }

  const mode = getPublicAccessMode(env);

  if (mode === "owner") {
    return false;
  }

  if (!canAccessCustomerArea(role)) {
    return false;
  }

  if (mode === "public") {
    return true;
  }

  // allowlist (controlled) rung
  return isCustomerAllowlisted(email, env);
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

// APP_ENGINE_OWNER_EMAIL accepts one address or a comma/space-separated list, so
// all of the owner's identities (GitHub-primary gmail, the ecosystem admin
// address) resolve to owner without an env edit per provider. The generated-app
// template already parses a list; this brings the factory itself to parity.
function isOwnerEmail(email?: string | null, env: RuntimeEnv = process.env) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return parseCustomerAllowlist(env.APP_ENGINE_OWNER_EMAIL).includes(normalizedEmail);
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
