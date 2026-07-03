import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-env-compose-"));
const sharedPath = path.join(tempDir, "shared.env");
const profilePath = path.join(tempDir, "churchconnect.env");
const outPath = path.join(tempDir, ".env");

fs.writeFileSync(
  sharedPath,
  [
    "SUPABASE_URL=https://example.supabase.co",
    "VITE_SUPABASE_URL=https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY=server-secret",
    "JWT_SECRET=jwt-secret",
    "ENCRYPTION_KEY=encryption-secret",
    "APP_ENGINE_OWNER_EMAIL=owner@example.com",
    "",
  ].join("\n"),
);

fs.writeFileSync(
  profilePath,
  [
    "APPENGINE_SHARED_ENV_KEYS=SUPABASE_URL,VITE_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,JWT_SECRET,ENCRYPTION_KEY,APP_ENGINE_OWNER_EMAIL",
    "APPENGINE_REQUIRED_ENV_KEYS=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,MONGO_URL,DB_NAME,CC_TEST_EMAIL,CC_TEST_PASSWORD",
    "MONGO_URL=mongodb://localhost:27017",
    "DB_NAME=churchconnect",
    "CC_TEST_EMAIL=Lincoln@milstead.church",
    "CC_TEST_PASSWORD=test-only",
    "SUPER_ADMIN_EMAIL=${APP_ENGINE_OWNER_EMAIL}",
    "",
  ].join("\n"),
);

const result = spawnSync(
  process.execPath,
  ["scripts/compose-app-env.mjs", "--shared", sharedPath, "--profile", profilePath, "--out", outPath],
  { cwd: process.cwd(), encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const output = fs.readFileSync(outPath, "utf8");
const requiredSnippets = [
  "SUPABASE_URL=https://example.supabase.co",
  "MONGO_URL=mongodb://localhost:27017",
  "SUPER_ADMIN_EMAIL=owner@example.com",
];

for (const snippet of requiredSnippets) {
  if (!output.includes(snippet)) {
    throw new Error(`Generated env missing expected snippet: ${snippet}`);
  }
}

if (output.includes("APPENGINE_SHARED_ENV_KEYS")) {
  throw new Error("Generated env leaked composer metadata keys.");
}

console.log("env composer smoke ok");
