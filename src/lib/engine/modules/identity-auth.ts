// identity-auth — the first real, app-ready module (the gold standard the rest are
// templated on). It emits a complete, hardened sign-in stack into every generated
// app, at parity with the factory's own auth:
//
//   * Google + email magic-link (Resend) + GitHub, each dormant until its keys exist
//   * database-backed roles (owner/admin/customer/vendor) resolved from
//     app_user_profiles — so admins are actually grantable, not env-only
//   * a whitelisted session response (toClientSession) so the pg-adapter
//     sessionToken can never leak into GET /api/auth/session
//   * trustHost + pages.signIn so OAuth callbacks work on any host
//   * a usable, branded /sign-in page with real per-error messaging and an
//     honest empty state when nothing is configured yet
//
// The auth adapter tables (users/accounts/sessions/verification_token/
// app_user_profiles) live in the base schema because the whole app FKs to
// users.id; this module owns the CODE and the sign-in UX.

import type { AppModule, AppModuleContext, GeneratedModuleFile } from "./types";

function file(path: string, lines: string[]): GeneratedModuleFile {
  return { path, content: lines.join("\n") + "\n" };
}

// ---- src/auth.ts -------------------------------------------------------------

function authConfigFile(): GeneratedModuleFile {
  return file("src/auth.ts", [
    'import NextAuth from "next-auth";',
    'import PostgresAdapter from "@auth/pg-adapter";',
    'import { Pool } from "@neondatabase/serverless";',
    'import GitHub from "next-auth/providers/github";',
    'import Google from "next-auth/providers/google";',
    'import Resend from "next-auth/providers/resend";',
    'import { resolveRole } from "@/lib/auth/roles";',
    'import { toClientSession } from "@/lib/auth/client-session";',
    "",
    "function configuredDatabaseUrl() {",
    "  const url = process.env.DATABASE_URL;",
    '  return url && !url.includes("USER:PASSWORD@HOST") ? url : undefined;',
    "}",
    "",
    "// Providers build from configured env, so each stays dormant until its keys",
    "// exist — adding the keys turns it on with no code change. Consumer-friendly",
    "// first (Google, email link); GitHub is a quiet secondary/owner option.",
    "function buildProviders(hasDatabase: boolean) {",
    "  const providers = [];",
    "  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {",
    "    providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));",
    "  }",
    "  // The email magic-link needs the database adapter to store its token, so it",
    "  // only activates when a database URL is present too.",
    "  if (hasDatabase && process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {",
    "    providers.push(Resend({ apiKey: process.env.AUTH_RESEND_KEY, from: process.env.EMAIL_FROM }));",
    "  }",
    "  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {",
    "    providers.push(GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }));",
    "  }",
    "  return providers;",
    "}",
    "",
    "export const { handlers, auth, signIn, signOut } = NextAuth(() => {",
    "  const databaseUrl = configuredDatabaseUrl();",
    "  return {",
    "    adapter: databaseUrl ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined,",
    '    secret: process.env.AUTH_SECRET || "generated-app-local-development-secret",',
    "    trustHost: true,",
    '    pages: { signIn: "/sign-in" },',
    "    providers: buildProviders(Boolean(databaseUrl)),",
    "    callbacks: {",
    "      async session({ session, user }) {",
    "        if (session.user) {",
    "          session.user.role = await resolveRole({ id: user?.id, email: session.user.email ?? user?.email });",
    "        }",
    "        // Return a whitelisted shape, never the raw session. Under the",
    "        // database-session strategy the object handed here is the adapter",
    "        // session ROW (sessionToken/userId); returning it wholesale would leak",
    "        // the sessionToken into GET /api/auth/session and defeat the httpOnly",
    "        // cookie. toClientSession rebuilds a minimal, safe object instead.",
    "        return toClientSession(session, user);",
    "      }",
    "    }",
    "  };",
    "});"
  ]);
}

// ---- src/lib/auth/client-session.ts (pure sanitizer, no cycles) -------------

function clientSessionFile(): GeneratedModuleFile {
  return file("src/lib/auth/client-session.ts", [
    'import type { Role } from "./roles";',
    "",
    "// The exact, whitelisted shape exposed from GET /api/auth/session. Rebuilding a",
    "// minimal object (rather than deleting known-bad keys) guarantees no adapter",
    "// session-row field — sessionToken, userId — can ever reach the client.",
    "export type ClientSession = {",
    "  user: { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: Role };",
    "  expires: string;",
    "};",
    "",
    "type SessionUserLike = { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: Role };",
    "type AdapterUserLike = { id?: string | number; email?: string | null };",
    "",
    "export function toClientSession(",
    "  session: { user?: SessionUserLike | null; expires: string },",
    "  user?: AdapterUserLike | null",
    "): ClientSession {",
    "  const sessionUser = session.user ?? {};",
    "  return {",
    "    user: {",
    "      id: sessionUser.id ?? (user?.id != null ? String(user.id) : undefined),",
    "      name: sessionUser.name ?? null,",
    "      email: sessionUser.email ?? user?.email ?? null,",
    "      image: sessionUser.image ?? null,",
    "      role: sessionUser.role",
    "    },",
    "    expires: session.expires",
    "  };",
    "}"
  ]);
}

// ---- src/lib/auth/roles.ts (DB-backed roles) --------------------------------

function rolesFile(ctx: AppModuleContext): GeneratedModuleFile {
  return file("src/lib/auth/roles.ts", [
    'import { neon } from "@neondatabase/serverless";',
    'import { rolePermissions } from "./permissions";',
    "",
    `export const roles = ${JSON.stringify(ctx.roles, null, 2)} as const;`,
    'export const defaultRoles = ["owner", "admin", "customer", "vendor"] as const;',
    "",
    "export type GeneratedRole = (typeof roles)[number];",
    "export type DefaultRole = (typeof defaultRoles)[number];",
    "export type Role = GeneratedRole | DefaultRole;",
    "",
    "const KNOWN_ROLES = new Set<string>([...roles, ...defaultRoles]);",
    "",
    "function ownerEmails(): string[] {",
    '  return (process.env.APP_ENGINE_OWNER_EMAIL || "")',
    '    .split(",")',
    "    .map((entry) => entry.trim().toLowerCase())",
    "    .filter(Boolean);",
    "}",
    "",
    "export function isOwnerEmail(email?: string | null): boolean {",
    "  const normalized = email?.trim().toLowerCase();",
    "  return Boolean(normalized && ownerEmails().includes(normalized));",
    "}",
    "",
    "export function normalizeRole(value: unknown): Role | undefined {",
    '  if (typeof value !== "string") return undefined;',
    "  const normalized = value.trim().toLowerCase();",
    "  return KNOWN_ROLES.has(normalized) ? (normalized as Role) : undefined;",
    "}",
    "",
    "// Kept for callers that only have an email (owner-override, else customer).",
    "export function roleForEmail(email?: string | null): Role {",
    '  return isOwnerEmail(email) ? "owner" : "customer";',
    "}",
    "",
    "function configuredDatabaseUrl(): string | undefined {",
    "  const url = process.env.DATABASE_URL;",
    '  return url && !url.includes("USER:PASSWORD@HOST") && /^postgres(?:ql)?:\\/\\//i.test(url) ? url : undefined;',
    "}",
    "",
    "// Resolve the definitive role: owner-email override first, then the stored",
    "// profile role from the database (so admins/vendors are actually grantable),",
    '// then "customer" by default. Best-effort DB read — never blocks sign-in.',
    "export async function resolveRole(user: { id?: string | number | null; email?: string | null }): Promise<Role> {",
    '  if (isOwnerEmail(user.email)) return "owner";',
    "  const databaseUrl = configuredDatabaseUrl();",
    "  const authUserId = typeof user.id === \"number\" ? user.id : typeof user.id === \"string\" && /^\\d+$/.test(user.id) ? Number(user.id) : undefined;",
    "  if (databaseUrl && authUserId) {",
    "    try {",
    "      const sql = neon(databaseUrl);",
    "      const rows = (await sql`select role from app_user_profiles where auth_user_id = ${authUserId} limit 1`) as Array<{ role?: unknown }>;",
    "      const role = normalizeRole(rows[0]?.role);",
    "      if (role) return role;",
    "    } catch {",
    "      // fall through to the default — a transient DB error must not lock a user out",
    "    }",
    "  }",
    '  return "customer";',
    "}",
    "",
    "export function canAccessAdmin(role?: string | null) {",
    '  return role === "owner" || role === "admin";',
    "}",
    "",
    "export function canAccessCustomerArea(role?: string | null) {",
    "  return Boolean(role && KNOWN_ROLES.has(role));",
    "}",
    "",
    "export function permissionsForRole(role?: string | null) {",
    "  return rolePermissions.find((entry) => entry.role === role)?.can || [];",
    "}"
  ]);
}

// ---- src/lib/auth/permissions.ts --------------------------------------------

function permissionsFile(ctx: AppModuleContext): GeneratedModuleFile {
  return file("src/lib/auth/permissions.ts", [
    `export const rolePermissions = ${JSON.stringify(ctx.roleMatrix, null, 2)} as const;`,
    "",
    `export const protectedRoutes = ${JSON.stringify(ctx.protectedRoutes, null, 2)} as const;`,
    "",
    "export type ProtectedRoute = (typeof protectedRoutes)[number];",
    "",
    "function pathMatches(pattern: string, path: string) {",
    '  if (pattern.endsWith("/*")) {',
    "    return path.startsWith(pattern.slice(0, -1));",
    "  }",
    '  return path === pattern || path.startsWith(pattern + "/");',
    "}",
    "",
    "export function allowedRolesForPath(path: string) {",
    "  const route = protectedRoutes.find((candidate) => pathMatches(candidate.path, path));",
    "  return route ? [...(route.access as readonly string[])] : [];",
    "}",
    "",
    'export function canAccessRoute(role?: string | null, path = "/") {',
    "  const allowedRoles = allowedRolesForPath(path);",
    "  return allowedRoles.length === 0 || Boolean(role && allowedRoles.includes(role));",
    "}"
  ]);
}

// ---- src/lib/auth/session.ts (current user + gates) -------------------------

function sessionFile(): GeneratedModuleFile {
  return file("src/lib/auth/session.ts", [
    'import { redirect } from "next/navigation";',
    'import { auth } from "@/auth";',
    'import { hasDatabase } from "@/lib/db/client";',
    'import { canAccessAdmin, canAccessCustomerArea, type Role } from "./roles";',
    "",
    "// Re-exported so existing imports of toClientSession from this module keep working.",
    'export { toClientSession, type ClientSession } from "./client-session";',
    "",
    "export type CurrentUser = { id: string; name: string; email: string; role: Role; mode: \"session\" | \"setup\" };",
    "",
    "function hasOAuthProvider() {",
    "  return Boolean(",
    "    (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) ||",
    "      (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)",
    "  );",
    "}",
    "",
    "export function hasEmailSignIn() {",
    "  return Boolean(process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM);",
    "}",
    "",
    "export function isAuthConfigured() {",
    "  return hasDatabase() && Boolean(process.env.AUTH_SECRET) && (hasOAuthProvider() || hasEmailSignIn());",
    "}",
    "",
    "export async function getCurrentUser(): Promise<CurrentUser | null> {",
    "  if (!isAuthConfigured()) {",
    "    // Local setup convenience only. A deployed app with unfinished auth stays",
    "    // locked (returns null) rather than silently granting owner.",
    '    if (process.env.NODE_ENV === "production") return null;',
    '    const email = (process.env.APP_ENGINE_OWNER_EMAIL || "owner@example.com").split(",")[0].trim();',
    '    return { id: "", name: "Local Setup User", email, role: "owner", mode: "setup" };',
    "  }",
    "  const session = await auth();",
    "  const email = session?.user?.email;",
    "  if (!email) return null;",
    '  const role = (session.user?.role as Role | undefined) ?? "customer";',
    "  return { id: session.user?.id ?? \"\", name: session.user?.name || email, email, role, mode: \"session\" };",
    "}",
    "",
    'export async function requireCustomerAccess(nextPath = "/app") {',
    "  const user = await getCurrentUser();",
    "  if (!user || !canAccessCustomerArea(user.role)) {",
    '    redirect("/sign-in?next=" + encodeURIComponent(nextPath));',
    "  }",
    "  return user;",
    "}",
    "",
    'export async function requireAdminAccess(nextPath = "/admin") {',
    "  const user = await getCurrentUser();",
    '  if (!user) redirect("/sign-in?next=" + encodeURIComponent(nextPath));',
    '  if (!canAccessAdmin(user.role)) redirect("/app");',
    "  return user;",
    "}"
  ]);
}

// ---- src/app/api/auth/[...nextauth]/route.ts --------------------------------

function nextAuthRouteFile(): GeneratedModuleFile {
  return file("src/app/api/auth/[...nextauth]/route.ts", [
    'import { handlers } from "@/auth";',
    "",
    "export const { GET, POST } = handlers;"
  ]);
}

// ---- src/types/next-auth.d.ts (role augmentation) ---------------------------

function typeAugmentationFile(): GeneratedModuleFile {
  return file("src/types/next-auth.d.ts", [
    'import "next-auth";',
    'import type { DefaultSession } from "next-auth";',
    'import type { Role } from "@/lib/auth/roles";',
    "",
    'declare module "next-auth" {',
    "  interface User {",
    "    role?: Role;",
    "  }",
    "  interface Session {",
    '    user: { role?: Role } & DefaultSession["user"];',
    "  }",
    "}"
  ]);
}

// ---- src/app/sign-in/page.tsx (usable, branded) -----------------------------

function signInPageFile(ctx: AppModuleContext): GeneratedModuleFile {
  const name = ctx.projectName;
  return file("src/app/sign-in/page.tsx", [
    'import { signIn } from "@/auth";',
    'import { hasEmailSignIn } from "@/lib/auth/session";',
    "",
    'export const dynamic = "force-dynamic";',
    "",
    "function hasGoogle() {",
    "  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);",
    "}",
    "function hasGithub() {",
    "  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);",
    "}",
    "",
    "// Auth.js redirects every failure back here as /sign-in?error=<code>. Silent",
    '// failures read as "login is broken", so each code gets a plain-language line.',
    "const ERROR_MESSAGES: Record<string, string> = {",
    '  OAuthSignin: "We couldn\'t start the sign-in. Please try again.",',
    '  OAuthCallback: "The sign-in provider didn\'t complete. Please try again.",',
    '  OAuthAccountNotLinked: "This email is already linked to a different sign-in method. Use the option you signed up with.",',
    '  AccessDenied: "Sign-in was cancelled or not permitted for this account.",',
    '  Verification: "That sign-in link expired or was already used. Request a fresh one.",',
    '  Configuration: "Sign-in isn\'t configured correctly right now. Please try again shortly.",',
    '  Default: "Something went wrong signing you in. Please try again."',
    "};",
    "",
    "function errorMessage(code?: string | string[]) {",
    "  if (!code) return null;",
    "  const single = Array.isArray(code) ? code[0] : code;",
    "  return ERROR_MESSAGES[single] || ERROR_MESSAGES.Default;",
    "}",
    "",
    "export default async function SignInPage({",
    "  searchParams",
    "}: {",
    "  searchParams?: Promise<{ error?: string | string[]; next?: string }>;",
    "}) {",
    "  const params = searchParams ? await searchParams : undefined;",
    "  const error = errorMessage(params?.error);",
    '  const next = typeof params?.next === "string" && params.next.startsWith("/") ? params.next : "/app";',
    "  const google = hasGoogle();",
    "  const email = hasEmailSignIn();",
    "  const github = hasGithub();",
    "  const anyProvider = google || email || github;",
    "  const consumerOption = google || email;",
    "",
    "  return (",
    '    <main className="shell hero">',
    '      <p className="eyebrow">Sign in</p>',
    `      <h1>Access ${name}</h1>`,
    "      {anyProvider ? (",
    "        <p>Sign in to open your workspace.</p>",
    "      ) : null}",
    "",
    "      {error ? (",
    '        <p className="note" role="alert">{error}</p>',
    "      ) : null}",
    "",
    '      <section className="stack signin-options">',
    "        {google ? (",
    "          <form",
    "            action={async () => {",
    '              "use server";',
    "              await signIn(\"google\", { redirectTo: next });",
    "            }}",
    "          >",
    '            <button className="button primary signin-full" type="submit">Continue with Google</button>',
    "          </form>",
    "        ) : null}",
    "",
    "        {email ? (",
    "          <form",
    '            className="signin-email"',
    "            action={async (formData: FormData) => {",
    '              "use server";',
    '              const address = String(formData.get("email") || "").trim();',
    "              await signIn(\"resend\", { email: address, redirectTo: next });",
    "            }}",
    "          >",
    '            <label className="signin-label" htmlFor="signin-email">Or enter your email — we\'ll send you a sign-in link</label>',
    '            <input id="signin-email" className="input" type="email" name="email" required placeholder="you@example.com" autoComplete="email" />',
    '            <button className="button primary signin-full" type="submit">Email me a sign-in link</button>',
    "          </form>",
    "        ) : null}",
    "",
    "        {github ? (",
    "          <form",
    "            action={async () => {",
    '              "use server";',
    "              await signIn(\"github\", { redirectTo: next });",
    "            }}",
    "          >",
    "            <button className={consumerOption ? \"button\" : \"button primary signin-full\"} type=\"submit\">Sign in with GitHub</button>",
    "          </form>",
    "        ) : null}",
    "",
    "        {!anyProvider ? (",
    "          <p className=\"note\">",
    '            {process.env.NODE_ENV === "production"',
    "              ? \"Sign-in isn't set up yet. The app owner needs to finish identity setup before accounts can log in.\"",
    "              : \"Local setup mode is active until DATABASE_URL, AUTH_SECRET, and a sign-in provider are configured.\"}",
    "          </p>",
    "        ) : null}",
    "      </section>",
    "    </main>",
    "  );",
    "}"
  ]);
}

export const identityAuthModule: AppModule = {
  slug: "identity-auth",
  name: "Identity & Auth",
  tier: "foundation",
  files: (ctx) => [
    authConfigFile(),
    clientSessionFile(),
    rolesFile(ctx),
    permissionsFile(ctx),
    sessionFile(),
    nextAuthRouteFile(),
    typeAugmentationFile(),
    signInPageFile(ctx)
  ],
  envLines: () => [
    "",
    "# Identity & Auth — each provider is dormant until its keys are set.",
    "# Google (consumer-friendly primary):",
    'AUTH_GOOGLE_ID=""',
    'AUTH_GOOGLE_SECRET=""',
    "# Email magic-link via Resend (needs the database too):",
    'AUTH_RESEND_KEY=""',
    'EMAIL_FROM=""',
    "# GitHub (secondary / owner option):",
    'AUTH_GITHUB_ID=""',
    'AUTH_GITHUB_SECRET=""'
  ],
  navLinks: () => [{ href: "/sign-in", label: "Sign in" }],
  requiredEnv: ["AUTH_SECRET"]
};
