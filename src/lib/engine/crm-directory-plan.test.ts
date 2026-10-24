import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const BIN = "/usr/lib/postgresql/16/bin";
const MIGRATIONS = new URL("../../../db/migrations/", import.meta.url);

function psql(dir: string, port: number, file: string): string {
  return execFileSync(`${BIN}/psql`, ["-h", dir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8"
  });
}

function assertFast(plan: string, label: string): string {
  assert.doesNotMatch(plan, /Seq Scan/, `${label}\n${plan}`);
  assert.match(plan, /Index Scan|Index Only Scan|Bitmap Index Scan/, label);
  const timing = plan.match(/Execution Time: ([0-9.]+) ms/);
  assert.ok(timing, plan);
  assert.ok(Number(timing[1]) < 1000, `${label} ${timing[1]} ms\n${plan}`);
  return `${label}: ${timing[1]} ms`;
}

describe("directory queries on a prod-sized table", () => {
  it("keeps each directory query under a second with an index", { timeout: 600_000 }, () => {
    const files = readdirSync(MIGRATIONS);
    assert.equal(
      files.some((name) => /create index[^;]*cc_churches_name_id_idx/i.test(readFileSync(new URL(name, MIGRATIONS), "utf8"))),
      false
    );
    const dir = mkdtempSync(join(tmpdir(), "crm-dir-plan-"));
    const port = 54333;
    execFileSync(`${BIN}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
    const server = spawn(
      `${BIN}/postgres`,
      ["-D", dir, "-p", String(port), "-k", dir, "-c", "listen_addresses=", "-c", "max_parallel_workers_per_gather=0"],
      { stdio: "ignore" }
    );
    const load = join(dir, "load.sql");
    const functions = readFileSync(new URL("012_crm_directory_functions.sql", MIGRATIONS), "utf8");
    const extension = readFileSync(new URL("012a_cc_churches_pg_trgm.sql", MIGRATIONS), "utf8");
    const indexes = files
      .filter((name) => /^012[b-z]/.test(name))
      .sort()
      .map((name) => readFileSync(new URL(name, MIGRATIONS), "utf8").replace(/\bconcurrently\b/gi, ""))
      .join("\n");
    writeFileSync(
      load,
      `
      select set_config('client_min_messages', 'warning', false);
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      create table public.cc_churches (id text primary key, doc jsonb);
      ${functions}
      ${extension}
      insert into public.cc_churches (id, doc)
      select 'id-' || lpad(i::text, 7, '0'),
             jsonb_build_object(
               'name', case when i % 80 = 0 then '' when i % 500 = 0 then 'Grace Chapel ' || i else 'Church ' || i end,
               'church_name', 'Church ' || i,
               'city', (array['Atlanta','Macon','Savannah','Augusta','Valdosta'])[1 + (i % 5)],
               'state', case when i % 400 = 0 then 'WY' when i % 3 = 0 then 'Georgia' else 'GA' end,
               'zip_code', lpad((30000 + (i % 9000))::text, 5, '0'),
               'county', (array['Fulton','Bibb','Baldwin'])[1 + (i % 3)],
               'lead_class', case when i % 1500 = 1 then 'campaign_planning' when i % 5 = 0 then 'under_construction' when i % 5 = 1 then 'staff_only' when i % 5 = 2 then 'other_services' else '' end,
               'crm_status', case when i % 9 = 0 then 'contacted' when i % 13 = 0 then 'new' else '' end,
               'jev_avl_fit', ((i % 9)::numeric / 2),
               'last_invited_at', case when i % 4 = 0 then '' else '2024-01-15' end,
               'last_contact_at', case when i % 6 = 0 then '2025-06-01' else '' end,
               'pastor_name', case when i % 3 = 0 then 'Pat Example' else '' end,
               'staff_contacts', case when i % 5 = 0 then '[{"name":"Sam"}]'::jsonb else '[]'::jsonb end,
               'building_stage', (array['none','exploring','campaign_planning','design','under_construction','recently_completed'])[1 + (i % 6)],
               'building_stage_recorded_at', '2026-04-01',
               'is_customer', case when i % 2500 = 7 then 'true' else '' end,
               'service_opportunities', case when i % 2000 = 3 then jsonb_build_object('website', jsonb_build_object('status','interested','note','','updated_at','2026-04-01')) else '{}'::jsonb end,
               'service_providers', case
                 when i % 2000 = 3 then jsonb_build_object(
                   'av', jsonb_build_object('provider_type','vendor','vendor_name','Messenger AVL','other_name','','note','AVL is already engaged on the current project','learned_from','','learned_at',''),
                   'website', jsonb_build_object('provider_type','other','vendor_name','','other_name','A local shop','note','','learned_from','','learned_at','')
                 )
                 when i % 1800 = 4 then jsonb_build_object(
                   'toner', jsonb_build_object('provider_type','vendor','vendor_name','Other Vendor','other_name','','note','','learned_from','','learned_at','')
                 )
                 else '{}'::jsonb
               end,
               'pad', repeat('x', 1800)
             )
        from generate_series(1, 151000) as i;
      create index cc_churches_name_i on public.cc_churches ((doc->>'name'));
      ${indexes}
      analyze public.cc_churches;
      do $$
      declare got text;
      begin
        select public.crm_church_opportunity_status(doc, 'website') into got from public.cc_churches where id = 'id-0000002';
        if got is distinct from 'possible' then raise exception 'website possible %', got; end if;
        select public.crm_church_opportunity_status(doc, 'churchconnect') into got from public.cc_churches where id = 'id-0000007';
        if got is distinct from 'active_customer' then raise exception 'churchconnect active %', got; end if;
        select public.crm_church_opportunity_status(doc, 'website') into got from public.cc_churches where id = 'id-0000007';
        if got is distinct from 'possible' then raise exception 'customer website %', got; end if;
        select public.crm_church_opportunity_status(doc, 'website') into got from public.cc_churches where id = 'id-0000003';
        if got is distinct from 'interested' then raise exception 'stored interested %', got; end if;
        select public.crm_church_opportunity_status(doc, 'toner') into got from public.cc_churches where id = 'id-0000002';
        if got is distinct from 'unknown' then raise exception 'toner %', got; end if;
      end $$;
      `
    );
    const explain = join(dir, "explain.sql");
    writeFileSync(
      explain,
      `
      \\pset pager off
      explain (analyze, format text)
      select id from public.cc_churches order by id limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where (public.crm_church_sort_name(doc), id) > ('Church 1001', 'id-0001001')
       order by public.crm_church_sort_name(doc), id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where coalesce(nullif(btrim(coalesce(doc->>'lead_class', '')), ''), '') = 'campaign_planning'
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_state_code(doc->>'state') = 'WY'
         and public.crm_church_last_contact(doc) = ''
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where coalesce(doc->>'name', '') ilike '%grace%'
          or coalesce(doc->>'church_name', '') ilike '%grace%'
          or coalesce(doc->>'city', '') ilike '%grace%'
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where coalesce(public.crm_church_fit(doc), -1) >= 3
       order by coalesce(public.crm_church_fit(doc), -1), id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where (public.crm_church_last_contact(doc), id) > ('2025-01-01', 'id-0000001')
       order by public.crm_church_last_contact(doc), id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_building_stage(doc) = 'design'
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_has_staff(doc)
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_opportunity_status(doc, 'website') = 'interested'
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_opportunity_status(doc, 'churchconnect') = 'active_customer'
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where public.crm_church_opportunity_status(doc, 'website') = 'possible'
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where coalesce(doc -> 'service_providers', '{}'::jsonb) @> jsonb_build_object('av', jsonb_build_object('provider_type', 'vendor'))
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where (lower(btrim(coalesce(doc #>> '{service_providers,av,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,av,vendor_name}', ''))) = 'messenger avl')
          or (lower(btrim(coalesce(doc #>> '{service_providers,website,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,website,vendor_name}', ''))) = 'messenger avl')
          or (lower(btrim(coalesce(doc #>> '{service_providers,toner,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,toner,vendor_name}', ''))) = 'messenger avl')
          or (lower(btrim(coalesce(doc #>> '{service_providers,laser,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,laser,vendor_name}', ''))) = 'messenger avl')
          or (lower(btrim(coalesce(doc #>> '{service_providers,churchconnect,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,churchconnect,vendor_name}', ''))) = 'messenger avl')
          or (lower(btrim(coalesce(doc #>> '{service_providers,local_mission,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,local_mission,vendor_name}', ''))) = 'messenger avl')
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where coalesce(doc -> 'service_providers', '{}'::jsonb) @> jsonb_build_object('website', jsonb_build_object('provider_type', 'vendor'))
          or coalesce(doc -> 'service_providers', '{}'::jsonb) @> jsonb_build_object('website', jsonb_build_object('provider_type', 'other'))
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.cc_churches
       where (
         (lower(btrim(coalesce(doc #>> '{service_providers,av,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,av,vendor_name}', ''))) = 'messenger avl')
         or (lower(btrim(coalesce(doc #>> '{service_providers,website,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,website,vendor_name}', ''))) = 'messenger avl')
         or (lower(btrim(coalesce(doc #>> '{service_providers,toner,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,toner,vendor_name}', ''))) = 'messenger avl')
         or (lower(btrim(coalesce(doc #>> '{service_providers,laser,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,laser,vendor_name}', ''))) = 'messenger avl')
         or (lower(btrim(coalesce(doc #>> '{service_providers,churchconnect,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,churchconnect,vendor_name}', ''))) = 'messenger avl')
         or (lower(btrim(coalesce(doc #>> '{service_providers,local_mission,provider_type}', ''))) = 'vendor' and lower(btrim(coalesce(doc #>> '{service_providers,local_mission,vendor_name}', ''))) = 'messenger avl')
       )
         and public.crm_church_opportunity_status(doc, 'website') in ('possible', 'interested')
       order by id
       limit 41;
      explain (analyze, format text)
      select id from public.crm_directory_page('', '', '', '', '', false, null, '', '', '', 'id', 'asc', '', '', 41);
      explain (analyze, format text)
      select id from public.crm_directory_page('', '', '', '', 'campaign_planning', false, null, '', '', '', 'id', 'asc', '', '', 41);
      explain (analyze, format text)
      select id from public.crm_directory_page('', 'WY', '', 'not_contacted', '', false, null, 'never', '', '', 'id', 'asc', '', '', 41);
      explain (analyze, format text)
      select id from public.crm_directory_page('', '', '', '', '', false, null, '', '', '', 'name', 'asc', 'id-0001001', 'Church 1001', 41);
      explain (analyze, format text)
      select id from public.crm_directory_page('', '', '', '', '', false, null, '', '', '', 'id', 'asc', '', '', 41, 'website:interested');
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
      psql(dir, port, load);
      const plan = psql(dir, port, explain);
      const parts = plan.split(/(?=^\s*(?:Index|Bitmap|Seq|Function|Sort|Limit|Gather))/m).join("\n");
      const blocks = plan.split(/\n(?= *explain \(analyze)/i);
      const queries = plan.split(/(?=QUERY PLAN)/).slice(1);
      assert.equal(queries.length >= 10, true, plan);
      const labels = [
        "id page",
        "name keyset",
        "lead class",
        "rare state + never contacted",
        "name search",
        "numeric fit",
        "last contact keyset",
        "building stage",
        "staff present",
        "website interested",
        "churchconnect active customer",
        "website possible",
        "provider type av vendor",
        "vendor name",
        "served by someone else",
        "vendor with opening",
        "directory function id page",
        "directory function lead class",
        "directory function rare state + never",
        "directory function name keyset",
        "directory function website interested"
      ];
      const lines: string[] = [];
      queries.forEach((query, index) => {
        const label = labels[index] ?? `query ${index}`;
        if (label.startsWith("directory function")) {
          const timing = query.match(/Execution Time: ([0-9.]+) ms/);
          assert.ok(timing, query);
          assert.ok(Number(timing[1]) < 1000, `${label} ${timing[1]} ms\n${query}`);
          lines.push(`${label}: ${timing[1]} ms`);
          return;
        }
        lines.push(assertFast(query, label));
      });
      writeFileSync("/tmp/crm-explain.txt", `${lines.join("\n")}\n\n${plan}`);
      assert.ok(parts || blocks);
    } finally {
      server.kill("SIGTERM");
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
