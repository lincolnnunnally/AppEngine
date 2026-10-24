import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const BIN = "/usr/lib/postgresql/16/bin";
const MIGRATION = new URL("../../../db/migrations/009_crm_patch_church_doc.sql", import.meta.url);

/**
 * PostgreSQL 16, text primary key. The old uuid argument fails here with
 * "operator does not exist: text = uuid". This runs the migration as written.
 */
describe("crm_patch_church_doc on PostgreSQL 16", () => {
  it("merges an allowlisted patch onto a text id and ignores every other key", () => {
    const version = execFileSync(`${BIN}/postgres`, ["--version"], { encoding: "utf8" });
    assert.match(version, /PostgreSQL\) 16\./);
    const dir = mkdtempSync(join(tmpdir(), "crm-patch-pg16-"));
    const port = 54329;
    execFileSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(`${BIN}/postgres`, ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], {
      stdio: "ignore"
    });
    const sql = join(dir, "patch.sql");
    const migration = readFileSync(MIGRATION, "utf8");
    writeFileSync(
      sql,
      `
      select set_config('client_min_messages', 'warning', false);
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      create table public.cc_churches (
        id text primary key,
        doc jsonb
      );
      insert into public.cc_churches (id, doc) values (
        'text-church-1',
        '{"name":"Grace Chapel","pastor_name":"Pat","staff_contacts":[],"updated_at":"2026-01-01"}'::jsonb
      );
      ${migration}
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"staff_contacts":[{"name":"Jane Doe"}],"crm_signals":[{"tag":"Technical/media staff"}],"updated_at":"2026-04-02","pastor_name":"should not land"}'::jsonb,
        '2026-01-01'
      );
      do $$
      declare
        doc jsonb;
        argtype text;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'pastor_name' is distinct from 'Pat' then
          raise exception 'pastor_name changed: %', doc;
        end if;
        if doc->'staff_contacts'->0->>'name' is distinct from 'Jane Doe' then
          raise exception 'contact missing: %', doc;
        end if;
        if doc->'crm_signals'->0->>'tag' is distinct from 'Technical/media staff' then
          raise exception 'signal missing: %', doc;
        end if;
        if doc->>'updated_at' is distinct from '2026-04-02' then
          raise exception 'updated_at missing: %', doc;
        end if;
        if doc ? 'should not land' then
          raise exception 'extra key landed: %', doc;
        end if;
        select t.typname into argtype
          from pg_proc p
          join pg_type t on t.oid = p.proargtypes[0]
         where p.proname = 'crm_patch_church_doc' and p.pronargs = 3;
        if argtype is distinct from 'text' then
          raise exception 'argument type is %', argtype;
        end if;
        select t.typname into argtype
          from pg_proc p
          join pg_type t on t.oid = p.proargtypes[2]
         where p.proname = 'crm_patch_church_doc' and p.pronargs = 3;
        if argtype is distinct from 'text' then
          raise exception 'expected version type is %', argtype;
        end if;
        if (select count(*) from public.crm_patch_church_doc(
          'text-church-1',
          '{"staff_contacts":[{"name":"Lost"}],"updated_at":"1999-01-01"}'::jsonb,
          '1999-01-01'
        )) <> 0 then
          raise exception 'stale version wrote a row';
        end if;
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->'staff_contacts'->0->>'name' is distinct from 'Jane Doe' then
          raise exception 'stale version replaced contacts: %', doc;
        end if;
        if split_part(current_setting('server_version'), '.', 1) is distinct from '16' then
          raise exception 'not PostgreSQL 16: %', current_setting('server_version');
        end if;
      end $$;
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
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const KIND_MIGRATION = new URL("../../../db/migrations/010_op_leads_kind_church_lead.sql", import.meta.url);

describe("op_leads_kind_check on PostgreSQL 16", () => {
  it("lets church-lead in after 010 and still rejects a kind that is not on the list", () => {
    const dir = mkdtempSync(join(tmpdir(), "op-leads-kind-pg16-"));
    const port = 54330;
    execFileSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(`${BIN}/postgres`, ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], { stdio: "ignore" });
    const sql = join(dir, "kind.sql");
    const migration = readFileSync(KIND_MIGRATION, "utf8");
    writeFileSync(
      sql,
      `
      select set_config('client_min_messages', 'warning', false);
      create table public.op_leads (
        id uuid primary key default gen_random_uuid(),
        kind text,
        constraint op_leads_kind_check check (kind = any (array['shop','field']))
      );
      insert into public.op_leads (kind) values ('shop'), ('field');
      do $$
      begin
        insert into public.op_leads (kind) values ('church-lead');
        raise exception 'church-lead inserted before 010';
      exception
        when check_violation then null;
      end $$;
      ${migration}
      ${migration}
      insert into public.op_leads (kind) values ('church-lead');
      do $$
      declare
        def text;
      begin
        select pg_get_constraintdef(oid) into def from pg_constraint where conname = 'op_leads_kind_check';
        if def is null or position('church-lead' in def) = 0 or position('shop' in def) = 0 or position('field' in def) = 0 then
          raise exception 'constraint is %', def;
        end if;
        if split_part(current_setting('server_version'), '.', 1) is distinct from '16' then
          raise exception 'not PostgreSQL 16: %', current_setting('server_version');
        end if;
        begin
          insert into public.op_leads (kind) values ('nope');
          raise exception 'bogus kind inserted';
        exception
          when check_violation then null;
        end;
      end $$;
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
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
