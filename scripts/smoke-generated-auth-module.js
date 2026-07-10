import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Verifies the identity-auth module — the gold-standard, app-ready module — emits
// a complete, hardened sign-in stack into every generated app. Structural checks
// on every emitted file PLUS a functional check that the emitted session
// sanitizer actually strips the pg-adapter sessionToken.
// Run: node scripts/smoke-generated-auth-module.js

const root = process.cwd();
let failures = 0;

function ok(label) { console.log(`ok - ${label}`); }
function bad(label, detail) { failures++; console.error(`not ok - ${label}${detail ? " :: " + detail : ""}`); }
function has(hay, needle, label) { hay.includes(needle) ? ok(label) : bad(label, `missing: ${needle}`); }
function hasnt(hay, needle, label) { !hay.includes(needle) ? ok(label) : bad(label, `should not contain: ${needle}`); }

const { identityAuthModule } = await import(pathToFileURL(path.join(root, "src/lib/engine/modules/identity-auth.ts")).href);

const ctx = {
  projectName: "Sample App",
  roles: ["owner", "admin", "customer", "vendor"],
  roleMatrix: [{ role: "owner", can: ["manage app operations"] }, { role: "customer", can: ["manage own account"] }],
  protectedRoutes: [{ path: "/app", access: ["owner", "admin", "customer"] }, { path: "/admin", access: ["owner", "admin"] }]
};
const files = Object.fromEntries(identityAuthModule.files(ctx).map((f) => [f.path, f.content]));
const get = (p) => { const c = files[p]; if (c == null) { bad(`emits ${p}`, "file not emitted"); return ""; } ok(`emits ${p}`); return c; };

// 1) all files present
const auth = get("src/auth.ts");
const clientSession = get("src/lib/auth/client-session.ts");
const roles = get("src/lib/auth/roles.ts");
const permissions = get("src/lib/auth/permissions.ts");
const session = get("src/lib/auth/session.ts");
const route = get("src/app/api/auth/[...nextauth]/route.ts");
const dts = get("src/types/next-auth.d.ts");
const signin = get("src/app/sign-in/page.tsx");

// 2) auth.ts — hardened config
has(auth, "next-auth/providers/resend", "auth: email magic-link (Resend) provider");
has(auth, "trustHost: true", "auth: trustHost set (OAuth callback works on any host)");
has(auth, 'pages: { signIn: "/sign-in" }', "auth: custom sign-in page wired");
has(auth, "resolveRole(", "auth: role resolved (not env-only)");
has(auth, "toClientSession(session, user)", "auth: session sanitized (no token leak)");
hasnt(auth, "return session;", "auth: never returns the raw session object");

// 3) client-session.ts — the whitelist sanitizer
has(clientSession, "export function toClientSession", "client-session: sanitizer present");
has(clientSession, "expires: session.expires", "client-session: rebuilds a minimal object");
hasnt(clientSession, ".sessionToken", "client-session: never reads a sessionToken property");

// 4) roles.ts — DB-backed roles
has(roles, "export async function resolveRole", "roles: DB-backed role resolver");
has(roles, "app_user_profiles", "roles: reads the stored profile role (admin is grantable)");
has(roles, "isOwnerEmail", "roles: owner-email override");
has(roles, "canAccessAdmin", "roles: admin gate");

// 5) session.ts — current user + gates + email detection
has(session, "export async function getCurrentUser", "session: getCurrentUser present");
has(session, "export function hasEmailSignIn", "session: email sign-in detection (parity with factory)");
has(session, "requireAdminAccess", "session: admin gate");
has(session, "requireCustomerAccess", "session: customer gate");
has(session, 'from "./client-session"', "session: re-exports the sanitizer for back-compat");

// 6) sign-in page — usable
has(signin, "Continue with Google", "sign-in: Google option");
has(signin, "Email me a sign-in link", "sign-in: email magic-link option");
has(signin, "Sign in with GitHub", "sign-in: GitHub option");
has(signin, "ERROR_MESSAGES", "sign-in: per-error human messaging");
has(signin, 'role="alert"', "sign-in: error is announced to screen readers");
has(signin, "isn't set up yet", "sign-in: honest empty state");

// 7) type augmentation + route
has(dts, 'declare module "next-auth"', "types: role augmentation present");
has(route, "export const { GET, POST } = handlers", "route: nextauth handler wired");

// 8) env lines
const env = (identityAuthModule.envLines?.() ?? []).join("\n");
["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_RESEND_KEY", "EMAIL_FROM", "AUTH_GITHUB_ID"].forEach((k) => has(env, k, `env: documents ${k}`));

// 9) generator wiring (structural) — the base schema lives in base-schema.ts (T12)
const gen = fs.readFileSync(path.join(root, "src/lib/engine/app-generator.ts"), "utf8");
const baseSchema = fs.readFileSync(path.join(root, "src/lib/engine/base-schema.ts"), "utf8");
has(gen, "composeModuleFiles(", "generator: composes registered modules (incl. auth)");
has(baseSchema, "email varchar(255) unique", "base schema: users.email is unique (no duplicate accounts)");
has(baseSchema, "id uuid primary key default gen_random_uuid()", "base schema: users.id is uuid (T12 identity decision)");
hasnt(gen, "content: `import NextAuth", "generator: inline auth literal removed");

// 10) FUNCTIONAL — the emitted sanitizer actually strips the sessionToken
const tmp = path.join(os.tmpdir(), `client-session-${process.pid}.ts`);
fs.writeFileSync(tmp, clientSession);
try {
  const { toClientSession } = await import(pathToFileURL(tmp).href);
  const leaky = {
    user: { id: "42", name: "Lincoln", email: "lincoln@unitedundergod.org", image: "https://x/y.png", role: "owner", emailVerified: "2020-01-01" },
    sessionToken: "SECRET-TOKEN-abc123",
    userId: "42",
    expires: "2099-01-01T00:00:00.000Z"
  };
  const payload = JSON.parse(JSON.stringify(toClientSession(leaky, { id: 42, email: "adapter@example.com" })));
  const serialized = JSON.stringify(payload);
  (Object.keys(payload).sort().join(",") === "expires,user") ? ok("sanitizer: top-level keys are exactly user + expires") : bad("sanitizer: extra top-level keys", Object.keys(payload).join(","));
  serialized.includes("SECRET-TOKEN") ? bad("sanitizer: sessionToken leaked!", serialized) : ok("sanitizer: sessionToken never serialized");
  serialized.includes("emailVerified") ? bad("sanitizer: emailVerified leaked") : ok("sanitizer: emailVerified stripped");
  (payload.user.role === "owner" && payload.user.email === "lincoln@unitedundergod.org") ? ok("sanitizer: role + email preserved") : bad("sanitizer: dropped role/email");
} finally {
  fs.rmSync(tmp, { force: true });
}

if (failures) { console.error(`\ngenerated-auth-module smoke FAILED (${failures})`); process.exit(1); }
console.log("\ngenerated-auth-module smoke ok");
