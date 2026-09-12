// Shared emitter for simple signed-in list + create modules.
// Used by new-app Lego blocks so we don't rebuild the same CRUD shell.

import type { AppModule, GeneratedModuleFile } from "./types";

function file(path: string, lines: string[]): GeneratedModuleFile {
  return { path, content: lines.join("\n") + "\n" };
}

export type SimpleField = { key: string; column: string; label: string; kind?: "text" | "textarea" | "number" };

export type SimpleListSpec = {
  slug: string;
  name: string;
  flag: string;
  table: string;
  path: string;
  heading: string;
  blurb: string;
  empty: string;
  button: string;
  fields: SimpleField[];
  titleField: string;
  bodyField?: string;
};

export function simpleListModule(spec: SimpleListSpec): AppModule {
  const libName = spec.slug.replace(/-/g, "_");
  const typeName = spec.name.replace(/[^A-Za-z0-9]/g, "") + "Row";
  const enabledFn = `${libName}Enabled`;
  const listFn = `list${typeName}s`;
  const createFn = `create${typeName}`;
  const apiPath = `/api/${spec.path.replace(/^\//, "")}`;
  const pagePath = spec.path;
  const flagEnv = spec.flag;

  const typeFields = spec.fields.map((f) => `  ${f.key}: string;`).join("\n");
  const rowMap = spec.fields
    .map((f) => `    ${f.key}: String(r.${f.column} ?? ""),`)
    .join("\n");
  const selectCols = ["id", ...spec.fields.map((f) => f.column), "created_at"].join(", ");
  const insertCols = spec.fields.map((f) => f.column).join(", ");
  const insertVals = spec.fields.map((f) => `\${input.${f.key}}`).join(", ");

  function libFile(): GeneratedModuleFile {
    return file(`src/lib/db/${spec.slug}.ts`, [
      'import { getDatabase, hasDatabase } from "@/lib/db/client";',
      "",
      `export type ${typeName} = {`,
      "  id: string;",
      typeFields,
      "  createdAt: string;",
      "};",
      "",
      `export function ${enabledFn}() { return process.env.${flagEnv} !== "false"; }`,
      "",
      `function row(r: Record<string, unknown>): ${typeName} {`,
      "  return {",
      "    id: String(r.id),",
      rowMap,
      '    createdAt: String(r.created_at || "")',
      "  };",
      "}",
      "",
      `export async function ${listFn}(): Promise<${typeName}[]> {`,
      "  if (!hasDatabase()) return [];",
      "  try {",
      "    const sql = getDatabase();",
      `    const rows = await sql\`select ${selectCols} from ${spec.table} order by created_at desc limit 100\`;`,
      "    return rows.map(row);",
      "  } catch { return []; }",
      "}",
      "",
      `export async function ${createFn}(input: { ${spec.fields.map((f) => `${f.key}: string`).join("; ")} }): Promise<boolean> {`,
      "  if (!hasDatabase()) return false;",
      "  const sql = getDatabase();",
      `  await sql\`insert into ${spec.table} (${insertCols}) values (${insertVals})\`;`,
      "  return true;",
      "}"
    ]);
  }

  function apiFile(): GeneratedModuleFile {
    const reads = spec.fields.map(
      (f) => `  const ${f.key} = typeof body.${f.key} === "string" ? body.${f.key}.trim() : "";`
    );
    const required = spec.fields[0].key;
    return file(`src/app/api${pagePath}/route.ts`, [
      'import { NextResponse } from "next/server";',
      'import { getCurrentUser } from "@/lib/auth/session";',
      'import { canAccessCustomerArea } from "@/lib/auth/roles";',
      `import { ${listFn}, ${createFn}, ${enabledFn} } from "@/lib/db/${spec.slug}";`,
      'export const dynamic = "force-dynamic";',
      "export async function GET() {",
      `  if (!${enabledFn}()) return NextResponse.json({ ok: false, message: "This feature is turned off." }, { status: 404 });`,
      "  const user = await getCurrentUser();",
      '  if (!canAccessCustomerArea(user?.role)) return NextResponse.json({ ok: false, message: "Please sign in." }, { status: 401 });',
      `  return NextResponse.json({ ok: true, records: await ${listFn}() });`,
      "}",
      "export async function POST(request: Request) {",
      "  const user = await getCurrentUser();",
      '  if (!canAccessCustomerArea(user?.role)) return NextResponse.json({ ok: false, message: "Please sign in." }, { status: 401 });',
      "  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;",
      ...reads,
      `  if (!${required}) return NextResponse.json({ ok: false, message: "A ${spec.fields[0].label.toLowerCase()} is required." }, { status: 400 });`,
      `  const ok = await ${createFn}({ ${spec.fields.map((f) => f.key).join(", ")} });`,
      '  if (!ok) return NextResponse.json({ ok: false, message: "Connect a database to save this." }, { status: 503 });',
      "  return NextResponse.json({ ok: true });",
      "}"
    ]);
  }

  function formFile(): GeneratedModuleFile {
    const inputs = spec.fields.map((f) => {
      if (f.kind === "textarea") {
        return `      <textarea className="input" name="${f.key}" placeholder="${f.label}" aria-label="${f.label}" />`;
      }
      const extra = f.kind === "number" ? ' type="number"' : "";
      const req = f.key === spec.fields[0].key ? " required" : "";
      return `      <input className="input"${extra} name="${f.key}"${req} placeholder="${f.label}" aria-label="${f.label}" />`;
    });
    const jsonBody = spec.fields.map((f) => `${f.key}: data.get("${f.key}")`).join(", ");
    return file(`src/app${pagePath}/${spec.slug}-form.tsx`, [
      '"use client";',
      'import { useState } from "react";',
      'import { useRouter } from "next/navigation";',
      `export function Form() {`,
      "  const router = useRouter();",
      '  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");',
      "  const [message, setMessage] = useState(\"\");",
      "  async function submit(event: React.FormEvent<HTMLFormElement>) {",
      "    event.preventDefault();",
      '    setStatus("saving");',
      "    const data = new FormData(event.currentTarget);",
      `    const response = await fetch("${apiPath}", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ${jsonBody} }) });`,
      "    const json = await response.json().catch(() => ({}));",
      "    if (!response.ok || !json.ok) { setStatus(\"error\"); setMessage(json.message || \"Could not save.\"); return; }",
      "    event.currentTarget.reset();",
      '    setStatus("idle");',
      "    router.refresh();",
      "  }",
      "  return (",
      '    <form className="stack" onSubmit={submit}>',
      ...inputs,
      '      {status === "error" ? <p className="note" role="alert">{message}</p> : null}',
      `      <button className="button primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : ${JSON.stringify(spec.button)}}</button>`,
      "    </form>",
      "  );",
      "}"
    ]);
  }

  function pageFile(): GeneratedModuleFile {
    const titleExpr = `{row.${spec.titleField}}`;
    const bodyExpr = spec.bodyField ? `{row.${spec.bodyField}}` : "";
    return file(`src/app${pagePath}/page.tsx`, [
      'import { requireCustomerAccess } from "@/lib/auth/session";',
      `import { ${listFn}, ${enabledFn} } from "@/lib/db/${spec.slug}";`,
      `import { Form } from "./${spec.slug}-form";`,
      'export const dynamic = "force-dynamic";',
      "export default async function Page() {",
      `  if (!${enabledFn}()) return (<main className="shell"><h1>${spec.heading}</h1><p>This feature is turned off for this app.</p></main>);`,
      `  await requireCustomerAccess("${pagePath}");`,
      `  const records = await ${listFn}();`,
      "  return (",
      '    <main className="shell">',
      `      <p className="eyebrow">${spec.name}</p>`,
      `      <h1>${spec.heading}</h1>`,
      `      <p>${spec.blurb}</p>`,
      "      <Form />",
      `      {records.length === 0 ? <p className="note">${spec.empty}</p> : (`,
      '        <section className="panel-list">',
      "          {records.map((row) => (",
      '            <article className="wide-card" key={row.id}>',
      `              <strong>${titleExpr}</strong>`,
      spec.bodyField ? `              <p>${bodyExpr}</p>` : "              {null}",
      "            </article>",
      "          ))}",
      "        </section>",
      "      )}",
    "    </main>",
      "  );",
      "}"
    ]);
  }

  const schemaCols = spec.fields
    .map((f) => `  ${f.column} text not null default '',`)
    .join("\n");

  return {
    slug: spec.slug,
    name: spec.name,
    tier: "optional",
    featureFlagEnv: flagEnv,
    files: () => [libFile(), apiFile(), formFile(), pageFile()],
    schemaSql: () =>
      [
        "",
        `create table if not exists ${spec.table} (`,
        "  id uuid primary key default gen_random_uuid(),",
        schemaCols,
        "  created_at timestamptz not null default now()",
        ");"
      ].join("\n"),
    envLines: () => ["", `# ${spec.name} — set to false to switch off.`, `${flagEnv}=true`],
    homeLinks: () => [`        <a className="button" href="${pagePath}">${spec.name}</a>`],
    navLinks: () => [{ href: pagePath, label: spec.name }]
  };
}
