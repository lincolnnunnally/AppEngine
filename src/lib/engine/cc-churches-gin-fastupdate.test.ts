import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const BIN = "/usr/lib/postgresql/16/bin";
const MIGRATION = new URL("../../../db/migrations/014_cc_churches_gin_fastupdate_off.sql", import.meta.url);

const INDEXES = [
  "cc_churches_doc_gin",
  "cc_churches_name_trgm_idx",
  "cc_churches_church_name_trgm_idx",
  "cc_churches_city_trgm_idx",
  "cc_churches_service_providers_idx"
];

describe("cc_churches GIN fastupdate migration", () => {
  it("names the five GIN indexes and skips a missing one", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    assert.match(sql, /fastupdate = off/);
    assert.match(sql, /pg_class/);
    assert.match(sql, /Down \(do not run as part of this file\)/);
    for (const name of INDEXES) {
      assert.match(sql, new RegExp(`'${name}'`));
      assert.match(sql, new RegExp(`alter index public\\.${name} set \\(fastupdate = on\\)`));
    }
    assert.doesNotMatch(sql, /alter index[^;\n]*cc_churches_service_providers_present_idx/i);
  });

  it("turns fastupdate off, leaves a missing index alone, and can run again", () => {
    const version = spawnSync(`${BIN}/postgres`, ["--version"], { encoding: "utf8" });
    assert.match(version.stdout, /PostgreSQL\) 16\./);
    const dir = mkdtempSync(join(tmpdir(), "gin-fastupdate-"));
    const port = 54334;
    spawnSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(`${BIN}/postgres`, ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], { stdio: "ignore" });
    const migration = readFileSync(MIGRATION, "utf8");
    const setup = join(dir, "setup.sql");
    const first = join(dir, "first.sql");
    const second = join(dir, "second.sql");
    writeFileSync(
      setup,
      `
      create extension if not exists pg_trgm;
      create table public.cc_churches (id text primary key, doc jsonb not null default '{}'::jsonb);
      insert into public.cc_churches (id, doc) values (
        'church-1',
        '{"name":"Grace","church_name":"Grace Chapel","city":"Macon","service_providers":{"av":{"provider_type":"us"}}}'::jsonb
      );
      create index cc_churches_doc_gin on public.cc_churches using gin (doc);
      create index cc_churches_name_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'name', '')) gin_trgm_ops);
      create index cc_churches_church_name_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'church_name', '')) gin_trgm_ops);
      create index cc_churches_service_providers_idx
        on public.cc_churches using gin ((coalesce(doc -> 'service_providers', '{}'::jsonb)) jsonb_path_ops);
      do $$
      declare opts text[];
      begin
        select c.reloptions into opts
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'cc_churches_doc_gin';
        if opts is not null and 'fastupdate=off' = any (opts) then
          raise exception 'doc gin already had fastupdate off: %', opts;
        end if;
      end $$;
      `
    );
    writeFileSync(
      first,
      `
      ${migration}
      do $$
      declare
        name text;
        opts text[];
      begin
        if exists (
          select 1 from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'cc_churches_city_trgm_idx'
        ) then
          raise exception 'city index should still be missing';
        end if;
        foreach name in array array[
          'cc_churches_doc_gin',
          'cc_churches_name_trgm_idx',
          'cc_churches_church_name_trgm_idx',
          'cc_churches_service_providers_idx'
        ]
        loop
          select c.reloptions into opts
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname = name and c.relkind = 'i';
          if opts is null or not ('fastupdate=off' = any (opts)) then
            raise exception '% fastupdate %', name, opts;
          end if;
        end loop;
      end $$;
      `
    );
    writeFileSync(
      second,
      `
      create index cc_churches_city_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'city', '')) gin_trgm_ops);
      ${migration}
      ${migration}
      do $$
      declare
        name text;
        opts text[];
      begin
        foreach name in array array[
          'cc_churches_doc_gin',
          'cc_churches_name_trgm_idx',
          'cc_churches_church_name_trgm_idx',
          'cc_churches_city_trgm_idx',
          'cc_churches_service_providers_idx'
        ]
        loop
          select c.reloptions into opts
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname = name and c.relkind = 'i';
          if opts is null or not ('fastupdate=off' = any (opts)) then
            raise exception '% fastupdate %', name, opts;
          end if;
        end loop;
        update public.cc_churches
           set doc = doc || '{"name":"Grace Chapel"}'::jsonb
         where id = 'church-1';
      end $$;
      `
    );
    const psql = (file: string) =>
      spawnSync(`${BIN}/psql`, ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", file], {
        encoding: "utf8"
      });
    try {
      let ready = false;
      for (let i = 0; i < 50; i += 1) {
        const probe = spawnSync(`${BIN}/pg_isready`, ["-h", dir, "-p", String(port), "-d", "postgres"], { stdio: "ignore" });
        if (probe.status === 0) {
          ready = true;
          break;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
      assert.equal(ready, true, "PostgreSQL 16 did not start");
      const created = psql(setup);
      assert.equal(created.status, 0, created.stderr);
      const applied = psql(first);
      assert.equal(applied.status, 0, applied.stderr);
      assert.match(applied.stderr, /Index public\.cc_churches_city_trgm_idx is missing\. Skipped\./);
      assert.match(applied.stderr, /Set fastupdate=off on public\.cc_churches_doc_gin\./);
      const again = psql(second);
      assert.equal(again.status, 0, again.stderr);
      assert.match(again.stderr, /Set fastupdate=off on public\.cc_churches_city_trgm_idx\./);
      assert.match(again.stderr, /Index public\.cc_churches_doc_gin already has fastupdate off\./);
      assert.match(again.stderr, /Index public\.cc_churches_city_trgm_idx already has fastupdate off\./);
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
