import fs from "node:fs";
import path from "node:path";

// Soft-launch GitHub OAuth callback contract. File-content + list checks so
// leftover walks cannot invent a second OAuth app or a wrong redirect_uri path.
// Run: npm run smoke:github-oauth-callbacks
const repoRoot = process.cwd();

const expected = [
  "https://appengine.unitedundergod.org/api/auth/callback/github",
  "https://dashboard.unitedundergod.org/api/auth/callback/github"
];

const weSucceedGithubCallback = "https://www.we-succeed.org/api/auth/callback/github";

runStep("Auth.js GitHub callback path is the catch-all route + provider id", () => {
  assertFileIncludes("src/app/api/auth/[...nextauth]/route.ts", [
    'import { handlers } from "@/auth"',
    "export const { GET, POST } = handlers"
  ]);
  assertFileIncludes("src/lib/auth/github-oauth.ts", [
    'export const GITHUB_PROVIDER_ID = "github"',
    "export const GITHUB_OAUTH_CALLBACK_PATH = `/api/auth/callback/${GITHUB_PROVIDER_ID}`",
    "PRODUCTION_GITHUB_OAUTH_CALLBACK_URLS"
  ]);
  assertFileIncludes("src/auth.ts", [
    "unpinAuthUrl",
    "trustHost: true",
    'GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })',
    "delete process.env.AUTH_URL"
  ]);
});

runStep("canonical production callback URLs stay host-aware on the existing app", () => {
  assertFileIncludes("src/lib/auth/github-oauth.ts", [
    "DASHBOARD_ORIGIN",
    "FACTORY_ORIGIN",
    "do not create a second app",
    "do not register"
  ]);
  assertFileExcludes("src/lib/auth/github-oauth.ts", [weSucceedGithubCallback]);
  assertFileIncludes("src/lib/auth/hosts.ts", [
    'export const FACTORY_HOST = "appengine.unitedundergod.org"',
    'export const DASHBOARD_HOST = "dashboard.unitedundergod.org"'
  ]);
  assertEqual(githubOAuthCallbackUrl("https://appengine.unitedundergod.org/"), expected[0], "factory");
  assertEqual(githubOAuthCallbackUrl("https://dashboard.unitedundergod.org"), expected[1], "desk");
  assertDeepEqual(productionCallbacks(), expected, "registered list");
});

runStep("docs and env contract name the same callback strings", () => {
  assertFileIncludes("source-of-truth/github-oauth-soft-launch-callbacks.md", expected);
  assertFileIncludes("source-of-truth/github-oauth-soft-launch-callbacks.md", [
    "do **not**",
    "create a second app",
    "is unpinned at runtime",
    "ChurchConnect PRs 221 / 222 / 287 / 293",
    "do not register",
    "not an App Engine soft-launch"
  ]);
  assertFileIncludes("source-of-truth/we-succeed-signin-activation-runbook.md", [
    "not App Engine soft-launch",
    "Do **not** register",
    ...expected
  ]);
  assertFileIncludes(".env.vercel.example", [
    "/api/auth/callback/github",
    "Do not pin AUTH_URL",
    "do not register"
  ]);
  assertFileExcludes(".env.vercel.example", [weSucceedGithubCallback]);
  assertFileExcludes(".env.example", [weSucceedGithubCallback]);
  assertFileExcludes("README.md", [weSucceedGithubCallback]);
  assertFileExcludes("src/lib/engine/ecosystem-credential-registry.ts", [
    "www.we-succeed.org /api/auth/callback/github"
  ]);
  assertFileIncludes("src/proxy.ts", ["PRODUCTION_GITHUB_OAUTH_CALLBACK_URLS"]);
});

console.log("github-oauth-callbacks smoke ok");

function githubOAuthCallbackUrl(origin) {
  return `${String(origin).replace(/\/$/, "")}/api/auth/callback/github`;
}

function productionCallbacks() {
  return [
    githubOAuthCallbackUrl("https://appengine.unitedundergod.org"),
    githubOAuthCallbackUrl("https://dashboard.unitedundergod.org")
  ];
}

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assertFileIncludes(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${rel} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function assertFileExcludes(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${rel} must not include ${JSON.stringify(needle)}`);
    }
  }
}

function assertEqual(actual, expectedValue, label) {
  if (actual !== expectedValue) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expectedValue, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(actual)}`);
  }
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    console.error(`fail  ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
