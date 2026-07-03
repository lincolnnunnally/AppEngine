import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Proves GET /api/auth/session cannot leak the raw session token. With the
// database-session strategy (@auth/pg-adapter) the object handed to the NextAuth
// `session` callback is the AdapterSession ROW merged with the user, so returning
// it wholesale serializes `sessionToken`/`userId` into the response and defeats
// the httpOnly cookie. The callback now routes through toClientSession(), a
// whitelist that emits only { user, expires }. Run: node scripts/smoke-auth-session-sanitized.js
const repoRoot = process.cwd();
const { toClientSession } = await import(
  pathToFileURL(path.join(repoRoot, "src/lib/auth/session.ts")).href
);

// The shape the adapter hands the callback: the full session row merged with the
// user (extra secret/row fields included on purpose, to prove they're stripped).
const leakyDatabaseSession = {
  id: "session-row-id-should-never-serialize",
  sessionToken: "raw-session-token-should-never-serialize",
  userId: "42",
  expires: "2099-01-01T00:00:00.000Z",
  user: {
    id: "42",
    name: "Lincoln",
    email: "lincoln@unitedundergod.org",
    emailVerified: "2026-01-01T00:00:00.000Z",
    image: "https://example.com/avatar.png",
    role: "owner"
  }
};
const adapterUser = { id: "42", email: "lincoln@unitedundergod.org" };

const payload = JSON.parse(JSON.stringify(toClientSession(leakyDatabaseSession, adapterUser)));

// 1) The response exposes ONLY user + expires at the top level.
assertEqual(Object.keys(payload).sort().join(","), "expires,user", "top-level keys are exactly user + expires");
assertEqual(Object.prototype.hasOwnProperty.call(payload, "sessionToken"), false, "no top-level sessionToken key");
assertEqual(Object.prototype.hasOwnProperty.call(payload, "userId"), false, "no top-level userId key");
assertEqual(Object.prototype.hasOwnProperty.call(payload, "id"), false, "no session-row id key");
assertEqual(Object.prototype.hasOwnProperty.call(payload.user, "sessionToken"), false, "no sessionToken on user");
assertEqual(Object.prototype.hasOwnProperty.call(payload.user, "emailVerified"), false, "no emailVerified on user");

// 2) No session-row/secret string may appear ANYWHERE in the serialized JSON.
const serialized = JSON.stringify(payload);
for (const forbidden of [
  "sessionToken",
  "raw-session-token-should-never-serialize",
  "session-row-id-should-never-serialize",
  "userId"
]) {
  if (serialized.includes(forbidden)) {
    throw new Error(`sanitized session leaked "${forbidden}": ${serialized}`);
  }
}

// 3) The useful, non-secret fields survive unchanged.
assertEqual(payload.user.id, "42", "user.id preserved");
assertEqual(payload.user.name, "Lincoln", "user.name preserved");
assertEqual(payload.user.email, "lincoln@unitedundergod.org", "user.email preserved");
assertEqual(payload.user.image, "https://example.com/avatar.png", "user.image preserved");
assertEqual(payload.user.role, "owner", "user.role preserved");
assertEqual(payload.expires, "2099-01-01T00:00:00.000Z", "expires preserved");

// 4) Falls back to the AdapterUser id/email when the session user omits them.
const filled = toClientSession(
  { user: { name: "No Ids", role: "customer" }, expires: "2099-01-01T00:00:00.000Z" },
  { id: "7", email: "fallback@example.com" }
);
assertEqual(filled.user.id, "7", "user.id falls back to adapter user");
assertEqual(filled.user.email, "fallback@example.com", "user.email falls back to adapter user");

// 5) Guard the wiring: auth.ts must route through the sanitizer, not return the
// raw session object.
const authSource = fs.readFileSync(path.join(repoRoot, "src/auth.ts"), "utf8");
if (!authSource.includes("toClientSession(session, user)")) {
  throw new Error("auth.ts must return toClientSession(session, user)");
}
if (/return\s+session\s*;/.test(authSource)) {
  throw new Error("auth.ts still returns the raw session object");
}

console.log("auth session sanitized smoke ok");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
