import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const BIN = "/usr/lib/postgresql/16/bin";

describe("directory first page on a prod-sized table", () => {
  it("reads 41 rows by primary key in under a second", () => {
    const dir = mkdtempSync(join(tmpdir(), "crm-dir-plan-"));
    const port = 54332;
    execFileSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(`${BIN}/postgres`, ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], { stdio: "ignore" });
    const sql = join(dir, "plan.sql");
    writeFileSync(
      sql,
      `
      create table public.cc_churches (id text primary key, doc jsonb);
      insert into public.cc_churches (id, doc)
      select 'id-' || lpad(i::text, 7, '0'),
             jsonb_build_object('name', 'Church ' || i, 'city', 'Town', 'state', 'GA', 'zip_code', '30000')
        from generate_series(1, 151000) as i;
      analyze public.cc_churches;
      `
    );
    const explain = join(dir, "explain.sql");
    writeFileSync(
      explain,
      `
      explain (analyze, format text)
      select id from public.cc_churches
       order by id
       limit 41;
      `
    );
    try {
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          execFileSync(`${BIN}/pg_isready`, ["-h", dir, "-p", String(port), "-d", "postgres"], { stdio: "ignore" });
          ready = true;
          break;
        } catch {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
      }
      assert.equal(ready, true, "PostgreSQL 16 did not start");
      execFileSync(`${BIN}/psql`, ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", sql], {
        stdio: "ignore"
      });
      const plan = execFileSync(`${BIN}/psql`, ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", explain], {
        encoding: "utf8"
      });
      assert.match(plan, /Index Scan|Index Only Scan/);
      const timing = plan.match(/Execution Time: ([0-9.]+) ms/);
      assert.ok(timing, plan);
      assert.ok(Number(timing[1]) < 1000, plan);
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
