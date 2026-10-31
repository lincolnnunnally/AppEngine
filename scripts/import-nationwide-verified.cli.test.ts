import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const csvText = [
  "church_id,church_name,city,state,zip,website_url,phone,role,role_class,contact_name,title,email,email_role,estimated_size,size_band,size_basis,source_url,confidence,shared_email,signal_types,lead_class,verify_status,verify_method,verify_notes,campaign_fit,directory_ready,emailable_result,origin,wave,source_file",
  "g1,Grace Chapel,Vidalia,GA,30474,https://gracechapel.example,9125550100,Technical Director,strict_av,Ada Example,Technical Director,ada@gracechapel.example,tech_director,,large_800_plus,,https://gracechapel.example/staff,high,no,staff,staff_only,verified,staff_page_name_title_email,,avl_tech_media,yes,not_run,sample,,sample"
].join("\n");

function runCli(args: string[], env: Record<string, string>): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/import-nationwide-verified.ts", ...args], {
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

describe("nationwide verified import cli", () => {
  it("dry-run goes through the importer and writes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nationwide-verified-"));
    try {
      const csvPath = join(dir, "large_avl_tech_verified.csv");
      const churchesPath = join(dir, "churches.json");
      writeFileSync(csvPath, csvText);
      writeFileSync(
        churchesPath,
        JSON.stringify([
          {
            id: "g1",
            name: "Grace Chapel",
            churchName: "",
            city: "Vidalia",
            state: "GA",
            website: "https://gracechapel.example",
            domain: "gracechapel.example",
            inCrm: true,
            contacts: []
          }
        ])
      );
      const result = await runCli(["--dry-run", "--report", join(dir, "unmatched.csv"), csvPath], {
        IMPORT_CHURCHES_JSON: churchesPath,
        VERCEL_ENV: "preview"
      });
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /nationwide verified: 1 in, 1 ready/);
      assert.match(result.stdout, /nothing is sent/);
      assert.match(result.stdout, /dry run: no churches were written/);
      assert.match(result.stdout, /matched: 1/);
      assert.equal(result.stdout.includes("ada@gracechapel.example"), false);
      assert.equal(result.stderr.includes("SUPABASE"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
