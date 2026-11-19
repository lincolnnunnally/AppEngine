import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { connectionStringForPg, getPgPool, isNeonUrl, sqlForUrl } from "./postgres.ts";

describe("which driver a database URL gets", () => {
  it("keeps Neon for Neon hosts only", () => {
    assert.equal(isNeonUrl("postgresql://u:p@ep-x-123.us-east-2.aws.neon.tech/db?sslmode=require"), true);
    assert.equal(isNeonUrl("postgresql://appengine_app.uqhqulrqcygsmmzdzemx:p@aws-1-us-east-2.pooler.supabase.com:5432/postgres"), false);
    assert.equal(isNeonUrl("postgresql://u:p@localhost:5432/db"), false);
  });

  it("drops sslmode so pg honours the ssl object", () => {
    assert.equal(connectionStringForPg("postgresql://u:p@h:5432/postgres?sslmode=require"), "postgresql://u:p@h:5432/postgres");
  });
});

// Runs against a real Postgres when APPENGINE_TEST_PG_URL is set (a login whose
// search_path is `appengine, public`, as on the LPL Supabase).
const testUrl = process.env.APPENGINE_TEST_PG_URL;

describe("the pg path behaves like the Neon driver", { skip: !testUrl }, () => {
  after(async () => {
    if (testUrl) await getPgPool(testUrl).end();
  });

  it("returns row arrays from tagged templates and .query, with parameters", async () => {
    const sql = sqlForUrl(testUrl!);
    const rows = await sql`select ${41}::int + 1 as answer, ${"o'brien"}::text as name`;
    assert.deepEqual(rows, [{ answer: 42, name: "o'brien" }]);
    const viaQuery = await sql.query("select $1::text as v", ["x"]);
    assert.deepEqual(viaQuery, [{ v: "x" }]);
  });

  it("creates new tables in the appengine schema", async () => {
    const sql = sqlForUrl(testUrl!);
    await sql`create table if not exists pg_path_probe (id int)`;
    const [row] = await sql`select table_schema from information_schema.tables where table_name = 'pg_path_probe'`;
    assert.equal(row.table_schema, "appengine");
    await sql`drop table pg_path_probe`;
  });
});
