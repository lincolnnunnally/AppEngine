import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const fixture = readFileSync(new URL("./fixtures/avl-referrals-sample.csv", import.meta.url), "utf8");
const secret = "super-secret-service-role-key";

function runCli(args: string[], env: Record<string, string>): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/import-avl-referrals.ts", ...args], {
      cwd: root,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env }
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

describe("avl referral import cli", () => {
  it("dry-run prints field and fit tags and writes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "avl-referral-"));
    try {
      const csvPath = join(dir, "builders_architects_avl_referrals_20261101.csv");
      writeFileSync(csvPath, fixture);
      const result = await runCli(["--dry-run", csvPath], { SUPABASE_SERVICE_ROLE_KEY: secret, SUPABASE_URL: "https://uqhqulrqcygsmmzdzemx.supabase.co" });
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /kind: field/);
      assert.match(result.stdout, /fit:avl_referral on every ready row/);
      assert.match(result.stdout, /role:builder 3/);
      assert.match(result.stdout, /role:architect 2/);
      assert.match(result.stdout, /role:design_build 1/);
      assert.match(result.stdout, /role:capital_campaign_consultant 1/);
      assert.match(result.stdout, /churches invented: 0/);
      assert.match(result.stdout, /nothing is sent/);
      assert.match(result.stdout, /dry run: nothing was written/);
      assert.match(result.stdout, /possible in-house AVL \(not invented\): Domus Studio, Paragon 360/);
      assert.equal(result.stdout.includes("ada@par.example"), false);
      assert.equal(result.stdout.includes(secret), false);
      assert.equal(result.stderr.includes(secret), false);
      assert.equal(result.stdout.includes("church-lead"), false);
      assert.equal(result.stdout.includes("referral-partner"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a production apply without both opt-ins", async () => {
    const dir = mkdtempSync(join(tmpdir(), "avl-referral-"));
    try {
      const csvPath = join(dir, "builders.csv");
      writeFileSync(csvPath, fixture);
      const result = await runCli(["--apply", csvPath], {
        SUPABASE_URL: "https://uqhqulrqcygsmmzdzemx.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: secret
      });
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /Refusing to write: this is the production database/);
      assert.match(result.stderr, /Nothing was written/);
      assert.equal(result.stdout.includes(secret), false);
      assert.equal(result.stderr.includes(secret), false);
      const half = await runCli(["--apply", "--allow-production", csvPath], {
        SUPABASE_URL: "https://uqhqulrqcygsmmzdzemx.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: secret,
        IMPORT_ALLOW_PROD: ""
      });
      assert.notEqual(half.code, 0);
      assert.match(half.stderr, /Nothing was written/);
      assert.equal(half.stderr.includes(secret), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
