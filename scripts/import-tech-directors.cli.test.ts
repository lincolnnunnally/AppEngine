import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PRODUCTION_PROJECT_REF } from "../src/lib/engine/tech-director.ts";

const root = new URL("..", import.meta.url).pathname;
const csvText = [
  "church,city,state,website,staff_page_url,name,title,contact,signal_types,evidence_quote,source_url,signal_date,score",
  "Grace Chapel,Vidalia,GA,https://gracechapel.example,https://gracechapel.example/staff,Ada,Director,,staff,Leads media.,https://gracechapel.example/staff,2026-01-01,5"
].join("\n");

type Call = { method: string; url: string };

function writePreload(dir: string, logPath: string): string {
  const preload = join(dir, "fetch-recorder.mjs");
  writeFileSync(
    preload,
    `import { appendFileSync } from "node:fs";
const log = ${JSON.stringify(logPath)};
const church = {
  id: "g1",
  name: "Grace Chapel",
  church_name: "",
  city: "Vidalia",
  state: "GA",
  website: "https://gracechapel.example",
  domain: "gracechapel.example",
  crm_status: "open",
  staff_contacts: [],
  crm_signals: []
};
globalThis.fetch = async (input, init = {}) => {
  const method = String(init.method || "GET").toUpperCase();
  const url = String(input && input.url ? input.url : input);
  appendFileSync(log, JSON.stringify({ method, url }) + "\\n");
  const headers = { "content-type": "application/json" };
  if (url.includes("rpc/crm_patch_church_doc")) {
    return new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function public.crm_patch_church_doc in the schema cache" }), { status: 404, headers });
  }
  if (method === "GET" && url.includes("select=doc")) {
    return new Response(JSON.stringify([{ doc: { name: "Grace Chapel", updated_at: "2026-01-01T00:00:00.000Z", staff_contacts: [], crm_signals: [] } }]), { status: 200, headers });
  }
  if (method === "GET" && url.includes("cc_churches")) {
    return new Response(JSON.stringify([church]), { status: 200, headers });
  }
  return new Response("[]", { status: 200, headers });
};
`
  );
  return preload;
}

function recorded(logPath: string): Call[] {
  try {
    return readFileSync(logPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Call);
  } catch {
    return [];
  }
}

function writeCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.method !== "GET" && call.method !== "HEAD");
}

function runCli(args: string[], env: Record<string, string>, preload: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--import", preload, "scripts/import-tech-directors.ts", ...args], {
      cwd: root,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        VERCEL_ENV: "preview",
        ...env
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

describe("tech director import cli", () => {
  it("makes no write requests when a custom domain is refused", async () => {
    const dir = mkdtempSync(join(tmpdir(), "import-tech-directors-"));
    try {
      const logPath = join(dir, "fetch.log");
      const csvPath = join(dir, "tech_directors.csv");
      writeFileSync(csvPath, csvText);
      const preload = writePreload(dir, logPath);
      const result = await runCli(["--apply", "--allow-production", csvPath], {
        SUPABASE_URL: "https://db.example.com",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        IMPORT_ALLOW_PROD: PRODUCTION_PROJECT_REF
      }, preload);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /not localhost or a known Supabase project/);
      assert.equal(result.stderr.includes("test-service-role"), false);
      assert.equal(writeCalls(recorded(logPath)).length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("makes no write requests when production is not confirmed with --yes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "import-tech-directors-"));
    try {
      const logPath = join(dir, "fetch.log");
      const csvPath = join(dir, "tech_directors.csv");
      const flaggedPath = join(dir, "missing-flagged.csv");
      writeFileSync(csvPath, csvText);
      const preload = writePreload(dir, logPath);
      const result = await runCli(["--apply", "--allow-production", "--flagged-file", flaggedPath, csvPath], {
        SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        IMPORT_ALLOW_PROD: PRODUCTION_PROJECT_REF
      }, preload);
      assert.notEqual(result.code, 0);
      assert.match(result.stdout, new RegExp(`target project ref: ${PRODUCTION_PROJECT_REF}`));
      assert.match(result.stdout, /matched: /);
      assert.match(result.stdout, new RegExp(`flagged file: none \\(${flaggedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
      assert.match(result.stderr, /production needs --yes/);
      assert.equal(result.stdout.includes("test-service-role"), false);
      const calls = recorded(logPath);
      assert.ok(calls.some((call) => call.method === "GET"));
      assert.equal(writeCalls(calls).length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops when crm_patch_church_doc is missing and does not PATCH the church document", async () => {
    const dir = mkdtempSync(join(tmpdir(), "import-tech-directors-"));
    try {
      const logPath = join(dir, "fetch.log");
      const csvPath = join(dir, "tech_directors.csv");
      writeFileSync(csvPath, csvText);
      const preload = writePreload(dir, logPath);
      const result = await runCli(["--apply", csvPath], {
        SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role"
      }, preload);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /crm_patch_church_doc is not on the server/);
      const calls = recorded(logPath);
      assert.ok(calls.some((call) => call.method === "POST" && call.url.includes("rpc/crm_patch_church_doc")));
      assert.equal(calls.some((call) => call.method === "PATCH"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
