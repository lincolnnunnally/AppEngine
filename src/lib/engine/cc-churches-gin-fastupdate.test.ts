import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const MIGRATIONS = new URL("../../../db/migrations/", import.meta.url);
const FASTUPDATE = new URL("014_cc_churches_gin_fastupdate_off.sql", MIGRATIONS);
const CLEAN = new URL("014a_cc_churches_gin_clean_pending_list.sql", MIGRATIONS);

const INDEXES = [
  "cc_churches_doc_gin",
  "cc_churches_name_trgm_idx",
  "cc_churches_church_name_trgm_idx",
  "cc_churches_city_trgm_idx",
  "cc_churches_service_providers_idx"
];

/** PG_BIN or POSTGRES_BIN overrides the directory. Production is PostgreSQL 17; local may be 16. */
function postgresBin(): string {
  const configured = (process.env.PG_BIN || process.env.POSTGRES_BIN || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  for (const version of ["17", "16"]) {
    const dir = `/usr/lib/postgresql/${version}/bin`;
    if (existsSync(join(dir, "postgres"))) return dir;
  }
  return "/usr/lib/postgresql/17/bin";
}

const BIN = postgresBin();

describe("cc_churches GIN fastupdate migration", () => {
  it("sets fastupdate one index at a time and cleans the pending list in a later file", () => {
    const sql = readFileSync(FASTUPDATE, "utf8");
    const clean = readFileSync(CLEAN, "utf8");
    assert.match(sql, /quiet window/i);
    assert.match(sql, /AccessExclusiveLock/);
    assert.match(sql, /SET lock_timeout = '2s'/);
    assert.match(sql, /does not flush entries already in the pending list/i);
    assert.match(sql, /014a/);
    assert.doesNotMatch(sql, /\bdo\s+\$\$/i);
    assert.doesNotMatch(sql, /next insert/i);
    const alters = sql.match(/^ALTER INDEX IF EXISTS /gim) ?? [];
    assert.equal(alters.length, INDEXES.length);
    for (const name of INDEXES) {
      assert.match(sql, new RegExp(`^ALTER INDEX IF EXISTS public\\.${name} SET \\(fastupdate = off\\);`, "m"));
      assert.match(sql, new RegExp(`alter index public\\.${name} set \\(fastupdate = on\\)`, "i"));
      assert.match(clean, new RegExp(`gin_clean_pending_list\\('public\\.${name}'::regclass\\)`));
    }
    assert.doesNotMatch(sql, /alter index[^;\n]*cc_churches_service_providers_present_idx/i);
    assert.match(clean, /SET statement_timeout = 0/);
    assert.match(clean, /postgres role/i);
    assert.match(clean, /VACUUM \(ANALYZE\) public\.cc_churches/);
    const cleans = clean.match(/^SELECT gin_clean_pending_list/gim) ?? [];
    assert.equal(cleans.length, INDEXES.length);
  });

  it("turns fastupdate off without clearing a pending list, then gin_clean_pending_list does", () => {
    const version = spawnSync(join(BIN, "postgres"), ["--version"], { encoding: "utf8" });
    assert.equal(version.status, 0, version.stderr || version.error?.message);
    assert.match(version.stdout, /PostgreSQL\) \d+\./);
    const dir = mkdtempSync(join(tmpdir(), "gin-fastupdate-"));
    const port = 54334;
    spawnSync(join(BIN, "initdb"), ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(join(BIN, "postgres"), ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses="], { stdio: "ignore" });
    const fastupdate = readFileSync(FASTUPDATE, "utf8");
    const clean = readFileSync(CLEAN, "utf8");
    const setup = join(dir, "setup.sql");
    const withoutCity = join(dir, "without-city.sql");
    const withCity = join(dir, "with-city.sql");
    const pending = join(dir, "pending.sql");
    writeFileSync(
      setup,
      `
      create extension if not exists pg_trgm;
      create extension if not exists pageinspect;
      create table public.cc_churches (id text primary key, doc jsonb not null default '{}'::jsonb);
      create index cc_churches_doc_gin on public.cc_churches using gin (doc);
      create index cc_churches_name_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'name', '')) gin_trgm_ops);
      create index cc_churches_church_name_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'church_name', '')) gin_trgm_ops);
      create index cc_churches_service_providers_idx
        on public.cc_churches using gin ((coalesce(doc -> 'service_providers', '{}'::jsonb)) jsonb_path_ops);
      insert into public.cc_churches (id, doc)
      select i::text,
             jsonb_build_object(
               'name', 'Church ' || i,
               'church_name', 'Chapel ' || i,
               'city', 'Macon',
               'service_providers', jsonb_build_object('av', jsonb_build_object('provider_type', 'us'))
             )
        from generate_series(1, 200) as i;
      `
    );
    writeFileSync(
      withoutCity,
      `
      ${fastupdate}
      do $$
      declare
        name text;
        opts text[];
        pending bigint;
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
          execute format(
            'select n_pending_tuples from gin_metapage_info(get_raw_page(%L, 0))',
            name
          ) into pending;
          if pending is null or pending < 1 then
            raise exception '% pending list was flushed by fastupdate=off (% )', name, pending;
          end if;
        end loop;
      end $$;
      `
    );
    writeFileSync(
      withCity,
      `
      create index cc_churches_city_trgm_idx on public.cc_churches using gin ((coalesce(doc->>'city', '')) gin_trgm_ops);
      insert into public.cc_churches (id, doc) values (
        'city-row',
        '{"name":"City Church","church_name":"City Chapel","city":"Macon","service_providers":{"av":{"provider_type":"us"}}}'::jsonb
      );
      ${fastupdate}
      do $$
      declare pending bigint;
      begin
        select n_pending_tuples into pending from gin_metapage_info(get_raw_page('cc_churches_city_trgm_idx', 0));
        if pending is null or pending < 1 then
          raise exception 'city pending list was flushed by fastupdate=off (%)', pending;
        end if;
      end $$;
      `
    );
    const checks = INDEXES.map(
      (name) => `
        select n_pending_tuples into pending from gin_metapage_info(get_raw_page('${name}', 0));
        if pending is distinct from 0 then
          raise exception '${name} pending list still has % tuples', pending;
        end if;
        select c.reloptions into opts
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = '${name}' and c.relkind = 'i';
        if opts is null or not ('fastupdate=off' = any (opts)) then
          raise exception '${name} fastupdate %', opts;
        end if;`
    ).join("\n");
    writeFileSync(
      pending,
      `
      ${clean}
      do $$
      declare
        opts text[];
        pending bigint;
      begin
        ${checks}
        update public.cc_churches
           set doc = doc || '{"name":"Grace Chapel"}'::jsonb
         where id = '1';
      end $$;
      `
    );
    const psql = (file: string) =>
      spawnSync(join(BIN, "psql"), ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", file], {
        encoding: "utf8"
      });
    try {
      let ready = false;
      for (let i = 0; i < 50; i += 1) {
        const probe = spawnSync(join(BIN, "pg_isready"), ["-h", dir, "-p", String(port), "-d", "postgres"], { stdio: "ignore" });
        if (probe.status === 0) {
          ready = true;
          break;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
      assert.equal(ready, true, `${BIN} did not start`);
      const created = psql(setup);
      assert.equal(created.status, 0, created.stderr);
      const applied = psql(withoutCity);
      assert.equal(applied.status, 0, applied.stderr);
      assert.match(`${applied.stdout}\n${applied.stderr}`, /cc_churches_city_trgm_idx" does not exist, skipping/i);
      const city = psql(withCity);
      assert.equal(city.status, 0, city.stderr);
      const cleaned = psql(pending);
      assert.equal(cleaned.status, 0, cleaned.stderr);
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
