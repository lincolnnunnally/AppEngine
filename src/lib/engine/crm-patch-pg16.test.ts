import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const BIN = "/usr/lib/postgresql/16/bin";
const MIGRATION = new URL("../../../db/migrations/009_crm_patch_church_doc.sql", import.meta.url);
const NORTHRIDGE = new URL("../../../db/migrations/013_northridge_avl_relationship.sql", import.meta.url);

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
        if (select count(*) from public.crm_patch_church_doc(
          'text-church-1',
          '{"crm_status":"contacted","updated_at":"2026-06-01"}'::jsonb,
          '2026-04-02'
        )) <> 1 then
          raise exception 'applied 009 did not copy updated_at';
        end if;
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'updated_at' is distinct from '2026-06-01' then
          raise exception 'applied 009 updated_at: %', doc;
        end if;
        if doc ? 'crm_status' and nullif(btrim(doc->>'crm_status'), '') is not null then
          raise exception 'status landed under 009: %', doc;
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

const LEAD_MIGRATION = new URL("../../../db/migrations/011_crm_patch_church_doc_lead_fields.sql", import.meta.url);
const BASE_MIGRATION = new URL("../../../db/migrations/009_crm_patch_church_doc.sql", import.meta.url);

describe("crm_patch_church_doc lead fields on PostgreSQL 16", () => {
  it("keeps the old keys and writes the new ones without clearing a later staff-only patch", () => {
    const dir = mkdtempSync(join(tmpdir(), "crm-patch-lead-pg16-"));
    const port = 54331;
    execFileSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(`${BIN}/postgres`, ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], { stdio: "ignore" });
    const sql = join(dir, "lead.sql");
    writeFileSync(
      sql,
      `
      select set_config('client_min_messages', 'warning', false);
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      create table public.cc_churches (id text primary key, doc jsonb);
      insert into public.cc_churches (id, doc) values (
        'text-church-1',
        '{"name":"Grace","pastor_name":"Pat","staff_contacts":[],"updated_at":"2026-01-01"}'::jsonb
      );
      ${readFileSync(BASE_MIGRATION, "utf8")}
      ${readFileSync(LEAD_MIGRATION, "utf8")}
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"staff_contacts":[{"name":"Jane"}],"crm_signals":[{"tag":"Technical/media staff"}],"crm_status":"new","lead_class":"campaign_planning","jev_avl_fit":3.5,"jev_project_stage":"planning-campaign","crm_offers":["churchconnect","easypeazy","laser"],"updated_at":"2026-04-02","pastor_name":"nope"}'::jsonb,
        '2026-01-01'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'pastor_name' is distinct from 'Pat' then raise exception 'pastor changed %', doc; end if;
        if doc->>'lead_class' is distinct from 'campaign_planning' then raise exception 'lead_class %', doc; end if;
        if doc->>'jev_avl_fit' is distinct from '3.5' then raise exception 'fit %', doc; end if;
        if doc->>'crm_status' is distinct from 'new' then raise exception 'status %', doc; end if;
        if doc->'crm_offers'->>2 is distinct from 'laser' then raise exception 'offers %', doc; end if;
      end $$;
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"staff_contacts":[{"name":"Jane"},{"name":"Sam"}],"updated_at":"2026-05-01"}'::jsonb,
        '2026-04-02'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'lead_class' is distinct from 'campaign_planning' then raise exception 'lead cleared %', doc; end if;
        if doc->'staff_contacts'->1->>'name' is distinct from 'Sam' then raise exception 'staff %', doc; end if;
        if (select count(*) from public.crm_patch_church_doc('text-church-1', '{"lead_class":"staff_only","updated_at":"1999-01-01"}'::jsonb, '1999-01-01')) <> 0 then
          raise exception 'stale write';
        end if;
      end $$;
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"avl_existing_relationship":true,"avl_existing_relationship_note":"Past sanctuary","avl_project_status":"avl_already_engaged","building_stage":"design","building_stage_recorded_at":"2026-08-01","updated_at":"2026-08-02","pastor_name":"nope"}'::jsonb,
        '2026-05-01'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'pastor_name' is distinct from 'Pat' then raise exception 'pastor changed %', doc; end if;
        if doc->>'lead_class' is distinct from 'campaign_planning' then raise exception 'lead cleared %', doc; end if;
        if doc ? 'avl_existing_relationship' then raise exception 'old relationship landed %', doc; end if;
        if doc ? 'avl_existing_relationship_note' then raise exception 'old note landed %', doc; end if;
        if doc ? 'avl_project_status' then raise exception 'old project landed %', doc; end if;
        if doc->>'building_stage' is distinct from 'design' then raise exception 'stage %', doc; end if;
        if doc->>'building_stage_recorded_at' is distinct from '2026-08-01' then raise exception 'recorded %', doc; end if;
        if doc ? 'pastor_name' and doc->>'pastor_name' = 'nope' then raise exception 'extra landed %', doc; end if;
      end $$;
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"service_opportunities":{"website":{"status":"possible","note":"No site","updated_at":"2026-09-01"},"operate":{"status":"possible","note":"no"},"toner":{"status":"unknown","note":"","updated_at":""}},"updated_at":"2026-09-02","pastor_name":"nope"}'::jsonb,
        '2026-08-02'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->'service_opportunities'->'website'->>'status' is distinct from 'possible' then raise exception 'website %', doc; end if;
        if doc->'service_opportunities'->'website'->>'note' is distinct from 'No site' then raise exception 'note %', doc; end if;
        if doc->'service_opportunities' ? 'operate' then raise exception 'operate landed %', doc; end if;
        if doc->'service_opportunities'->'toner'->>'status' is distinct from 'unknown' then raise exception 'toner %', doc; end if;
        if doc->>'pastor_name' is distinct from 'Pat' then raise exception 'pastor changed %', doc; end if;
        if doc ? 'avl_project_status' then raise exception 'old project landed %', doc; end if;
      end $$;
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"service_providers":{"av":{"provider_type":"vendor","vendor_name":"Messenger AVL","other_name":"should drop","note":"AVL is already engaged on the current project","learned_from":"Lincoln","learned_at":"2026-10-01"},"operate":{"provider_type":"us"},"website":{"provider_type":"nope","vendor_name":"Hidden"}},"updated_at":"2026-10-02","pastor_name":"nope"}'::jsonb,
        '2026-09-02'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->'service_providers'->'av'->>'provider_type' is distinct from 'vendor' then raise exception 'av type %', doc; end if;
        if doc->'service_providers'->'av'->>'vendor_name' is distinct from 'Messenger AVL' then raise exception 'vendor %', doc; end if;
        if coalesce(doc->'service_providers'->'av'->>'other_name', '') <> '' then raise exception 'other name on vendor %', doc; end if;
        if doc->'service_providers' ? 'operate' then raise exception 'operate provider %', doc; end if;
        if doc->'service_providers'->'website'->>'provider_type' is distinct from 'unknown' then raise exception 'bad type %', doc; end if;
        if coalesce(doc->'service_providers'->'website'->>'vendor_name', '') <> '' then raise exception 'vendor name without vendor %', doc; end if;
        if doc->'service_providers'->'av'->>'learned_at' is distinct from '2026-10-01' then raise exception 'learned %', doc; end if;
        if doc->>'updated_at' is distinct from '2026-10-02' then raise exception 'provider updated_at %', doc; end if;
      end $$;
      select id from public.crm_patch_church_doc(
        'text-church-1',
        '{"service_providers":{"av":{"provider_type":"vendor","vendor_name":"Messenger AVL","note":"AVL is already engaged on the current project","learned_from":"Lincoln","learned_at":"2026-02-31"},"website":{"provider_type":"unknown","learned_at":"2026-04-31"}},"updated_at":"2026-10-04"}'::jsonb,
        '2026-10-02'
      );
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if coalesce(doc->'service_providers'->'av'->>'learned_at', '') <> '' then raise exception 'bad learned day %', doc; end if;
        if coalesce(doc->'service_providers'->'website'->>'learned_at', '') <> '' then raise exception 'bad website day %', doc; end if;
        if doc->'service_providers'->'av'->>'vendor_name' is distinct from 'Messenger AVL' then raise exception 'vendor kept %', doc; end if;
        if (select count(*) from public.crm_patch_church_doc('text-church-1', '{"service_providers":{"operate":{"provider_type":"us"}},"updated_at":"2098-01-01"}'::jsonb, '2026-10-04')) <> 0 then
          raise exception 'empty provider patch wrote a row';
        end if;
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->'service_providers'->'av'->>'vendor_name' is distinct from 'Messenger AVL' then raise exception 'providers wiped %', doc; end if;
        if doc->>'updated_at' is distinct from '2026-10-04' then raise exception 'empty provider patch bumped %', doc; end if;
        if (select count(*) from public.crm_patch_church_doc('text-church-1', '{"updated_at":"2099-01-01"}'::jsonb, '2026-10-04')) <> 0 then
          raise exception 'updated_at-only wrote a row';
        end if;
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'updated_at' is distinct from '2026-10-04' then raise exception 'updated_at-only bumped %', doc; end if;
        if (select count(*) from public.crm_patch_church_doc('text-church-1', '{"crm_status":"contacted","updated_at":"2026-10-03"}'::jsonb, '2026-10-04')) <> 1 then
          raise exception 'status save did not write';
        end if;
        select cc_churches.doc into doc from public.cc_churches where id = 'text-church-1';
        if doc->>'crm_status' is distinct from 'contacted' then raise exception 'status %', doc; end if;
        if doc->>'updated_at' is distinct from '2026-10-03' then raise exception 'status save updated_at %', doc; end if;
      end $$;
      insert into public.cc_churches (id, doc) values ('fb3d153f-dac5-49fc-ad9f-2f594d4dcc24', null);
      ${readFileSync(NORTHRIDGE, "utf8")}
      do $$
      declare doc jsonb;
      begin
        select cc_churches.doc into doc from public.cc_churches where id = 'fb3d153f-dac5-49fc-ad9f-2f594d4dcc24';
        if doc->'service_providers'->'av'->>'provider_type' is distinct from 'vendor' then raise exception 'northridge type %', doc; end if;
        if doc->'service_providers'->'av'->>'vendor_name' is distinct from 'Messenger AVL' then raise exception 'northridge vendor %', doc; end if;
        if doc->'service_providers'->'av'->>'note' is distinct from 'AVL is already engaged on the current project' then raise exception 'northridge note %', doc; end if;
        if doc ? 'crm_status' and nullif(btrim(doc->>'crm_status'), '') is not null then raise exception 'northridge status %', doc; end if;
        if doc ? 'avl_existing_relationship' then raise exception 'northridge old relationship %', doc; end if;
      end $$;
      create temporary table northridge_stamp as
        select doc->>'updated_at' as updated_at from public.cc_churches where id = 'fb3d153f-dac5-49fc-ad9f-2f594d4dcc24';
      ${readFileSync(NORTHRIDGE, "utf8")}
      do $$
      declare doc jsonb; stamp text;
      begin
        select updated_at into stamp from northridge_stamp;
        select cc_churches.doc into doc from public.cc_churches where id = 'fb3d153f-dac5-49fc-ad9f-2f594d4dcc24';
        if doc->'service_providers'->'av'->>'vendor_name' is distinct from 'Messenger AVL' then raise exception 'second vendor %', doc; end if;
        if doc->>'updated_at' is distinct from stamp then raise exception 'second run moved updated_at from % to %', stamp, doc->>'updated_at'; end if;
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
