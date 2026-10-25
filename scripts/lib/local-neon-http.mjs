// A local stand-in for Neon's SQL-over-HTTP endpoint, backed by a real Postgres,
// so generated apps (which talk to their database only through
// @neondatabase/serverless `neon()`) run UNMODIFIED in tests and CI.
//
// The driver POSTs { query, params } (or { queries: [...] } for a transaction)
// with headers Neon-Connection-String / Neon-Array-Mode / Neon-Raw-Text-Output,
// and expects { fields:[{name,dataTypeID}], rows:[[text…]], command, rowCount }.
// The database is the path of the connection string, so one Postgres server
// hosts one database per app under test. Pair with neon-fetch-redirect.cjs,
// which points the driver's https://api.<host>/sql at this server.
import http from "node:http";
import pg from "pg";

const RAW_TEXT = { getTypeParser: () => (value) => value };

export async function startLocalNeon({ postgresUrl, port = 0 }) {
  const base = new URL(postgresUrl);
  const pools = new Map();
  const poolFor = (database) => {
    if (!pools.has(database)) {
      const url = new URL(base);
      url.pathname = `/${database}`;
      pools.set(database, new pg.Pool({ connectionString: url.toString(), max: 4 }));
    }
    return pools.get(database);
  };
  const shape = (result) => ({
    command: result.command,
    rowCount: result.rowCount ?? 0,
    rows: result.rows ?? [],
    fields: (result.fields ?? []).map((field) => ({ name: field.name, dataTypeID: field.dataTypeID }))
  });

  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const connection = new URL(String(req.headers["neon-connection-string"] || ""));
      const database = decodeURIComponent(connection.pathname.replace(/^\//, "")) || "postgres";
      const payload = JSON.parse(body || "{}");
      const client = await poolFor(database).connect();
      try {
        const run = (q) => client.query({ text: q.query, values: q.params ?? [], rowMode: "array", types: RAW_TEXT });
        if (Array.isArray(payload.queries)) {
          await client.query("begin");
          try {
            const results = [];
            for (const q of payload.queries) results.push(shape(await run(q)));
            await client.query("commit");
            reply(200, { results });
          } catch (error) {
            await client.query("rollback").catch(() => {});
            throw error;
          }
        } else {
          reply(200, shape(await run(payload)));
        }
      } finally {
        client.release();
      }
    } catch (error) {
      reply(400, { message: error.message, code: error.code, detail: error.detail, severity: error.severity });
    }
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await Promise.all([...pools.values()].map((pool) => pool.end()));
    }
  };
}
