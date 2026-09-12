// guided-intake — a reusable problem/goal capture form for generated apps.
// Mined from AppEngine conversational intake (problem, who, outcome, barriers).

import type { AppModule, GeneratedModuleFile } from "./types";

function file(path: string, lines: string[]): GeneratedModuleFile {
  return { path, content: lines.join("\n") + "\n" };
}

function libFile(): GeneratedModuleFile {
  return file("src/lib/db/guided-intake.ts", [
    'import { getDatabase, hasDatabase } from "@/lib/db/client";',
    "",
    "export type IntakeRow = { id: string; problem: string; whoFor: string; outcome: string; barriers: string; createdAt: string };",
    "",
    "export function intakeEnabled() { return process.env.FEATURE_INTAKE !== \"false\"; }",
    "",
    "const fallback: IntakeRow[] = [];",
    "",
    "function row(r: Record<string, unknown>): IntakeRow {",
    "  return { id: String(r.id), problem: String(r.problem || \"\"), whoFor: String(r.who_for || \"\"), outcome: String(r.outcome || \"\"), barriers: String(r.barriers || \"\"), createdAt: String(r.created_at || \"\") };",
    "}",
    "",
    "export async function listIntakes(): Promise<IntakeRow[]> {",
    "  if (!hasDatabase()) return fallback;",
    "  try {",
    "    const sql = getDatabase();",
    "    const rows = await sql`select id, problem, who_for, outcome, barriers, created_at from guided_intakes order by created_at desc limit 100`;",
    "    return rows.map(row);",
    "  } catch { return fallback; }",
    "}",
    "",
    "export async function createIntake(input: { problem: string; whoFor: string; outcome: string; barriers?: string }): Promise<boolean> {",
    "  if (!hasDatabase()) return false;",
    "  const sql = getDatabase();",
    "  await sql`insert into guided_intakes (problem, who_for, outcome, barriers) values (${input.problem}, ${input.whoFor}, ${input.outcome}, ${input.barriers || \"\"})`;",
    "  return true;",
    "}"
  ]);
}

function apiFile(): GeneratedModuleFile {
  return file("src/app/api/intake/route.ts", [
    'import { NextResponse } from "next/server";',
    'import { getCurrentUser } from "@/lib/auth/session";',
    'import { canAccessCustomerArea } from "@/lib/auth/roles";',
    'import { listIntakes, createIntake, intakeEnabled } from "@/lib/db/guided-intake";',
    'export const dynamic = "force-dynamic";',
    "export async function GET() {",
    '  if (!intakeEnabled()) return NextResponse.json({ ok: false, message: "Intake is turned off." }, { status: 404 });',
    "  const user = await getCurrentUser();",
    '  if (!canAccessCustomerArea(user?.role)) return NextResponse.json({ ok: false, message: "Please sign in." }, { status: 401 });',
    "  return NextResponse.json({ ok: true, records: await listIntakes() });",
    "}",
    "export async function POST(request: Request) {",
    "  const user = await getCurrentUser();",
    '  if (!canAccessCustomerArea(user?.role)) return NextResponse.json({ ok: false, message: "Please sign in." }, { status: 401 });',
    "  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;",
    '  const problem = typeof body.problem === "string" ? body.problem.trim() : "";',
    '  const whoFor = typeof body.whoFor === "string" ? body.whoFor.trim() : "";',
    '  const outcome = typeof body.outcome === "string" ? body.outcome.trim() : "";',
    "  if (problem.length < 8 || !whoFor || !outcome) return NextResponse.json({ ok: false, message: \"Tell us the problem, who it's for, and the outcome.\" }, { status: 400 });",
    '  const barriers = typeof body.barriers === "string" ? body.barriers : "";',
    "  const ok = await createIntake({ problem, whoFor, outcome, barriers });",
    '  if (!ok) return NextResponse.json({ ok: false, message: "Connect a database to save intake." }, { status: 503 });',
    "  return NextResponse.json({ ok: true });",
    "}"
  ]);
}

function pageFile(): GeneratedModuleFile {
  return file("src/app/intake/page.tsx", [
    'import { requireCustomerAccess } from "@/lib/auth/session";',
    'import { listIntakes, intakeEnabled } from "@/lib/db/guided-intake";',
    'import { IntakeForm } from "./intake-form";',
    'export const dynamic = "force-dynamic";',
    "export default async function IntakePage() {",
    "  if (!intakeEnabled()) return (<main className=\"shell\"><h1>Intake</h1><p>Intake is turned off for this app.</p></main>);",
    '  await requireCustomerAccess("/intake");',
    "  const records = await listIntakes();",
    "  return (",
    '    <main className="shell">',
    '      <p className="eyebrow">Intake</p>',
    "      <h1>What needs to change?</h1>",
    "      <p>Capture the problem, who it is for, and the outcome you want — one place, no maze.</p>",
    "      <IntakeForm />",
    "      {records.length === 0 ? <p className=\"note\">Nothing captured yet.</p> : (",
    '        <section className="panel-list">',
    "          {records.map((row) => (",
    '            <article className="wide-card" key={row.id}>',
    "              <strong>{row.problem}</strong>",
    "              <p>For {row.whoFor}. So they can {row.outcome}.</p>",
    "            </article>",
    "          ))}",
    "        </section>",
    "      )}",
    "    </main>",
    "  );",
    "}"
  ]);
}

function formFile(): GeneratedModuleFile {
  return file("src/app/intake/intake-form.tsx", [
    '"use client";',
    "import { useState } from \"react\";",
    "import { useRouter } from \"next/navigation\";",
    "export function IntakeForm() {",
    "  const router = useRouter();",
    '  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");',
    "  const [message, setMessage] = useState(\"\");",
    "  async function submit(event: React.FormEvent<HTMLFormElement>) {",
    "    event.preventDefault();",
    '    setStatus("saving");',
    "    const data = new FormData(event.currentTarget);",
    "    const response = await fetch(\"/api/intake\", { method: \"POST\", headers: { \"content-type\": \"application/json\" }, body: JSON.stringify({ problem: data.get(\"problem\"), whoFor: data.get(\"whoFor\"), outcome: data.get(\"outcome\"), barriers: data.get(\"barriers\") }) });",
    "    const json = await response.json().catch(() => ({}));",
    "    if (!response.ok || !json.ok) { setStatus(\"error\"); setMessage(json.message || \"Could not save.\"); return; }",
    "    event.currentTarget.reset();",
    '    setStatus("idle");',
    "    router.refresh();",
    "  }",
    "  return (",
    '    <form className="stack" onSubmit={submit}>',
    '      <textarea className="input" name="problem" required minLength={8} placeholder="What is the problem?" aria-label="Problem" />',
    '      <input className="input" name="whoFor" required placeholder="Who is it for?" aria-label="Who" />',
    '      <input className="input" name="outcome" required placeholder="What should they be able to do?" aria-label="Outcome" />',
    '      <input className="input" name="barriers" placeholder="What makes it hard today? (optional)" aria-label="Barriers" />',
    '      {status === "error" ? <p className="note" role="alert">{message}</p> : null}',
    '      <button className="button primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save this"}</button>',
    "    </form>",
    "  );",
    "}"
  ]);
}

export const guidedIntakeModule: AppModule = {
  slug: "intake",
  name: "Guided intake",
  tier: "optional",
  featureFlagEnv: "FEATURE_INTAKE",
  files: () => [libFile(), apiFile(), pageFile(), formFile()],
  schemaSql: () =>
    [
      "",
      "create table if not exists guided_intakes (",
      "  id uuid primary key default gen_random_uuid(),",
      "  problem text not null default '',",
      "  who_for text not null default '',",
      "  outcome text not null default '',",
      "  barriers text not null default '',",
      "  created_at timestamptz not null default now()",
      ");"
    ].join("\n"),
  envLines: () => ["", "# Guided intake — set to false to switch capture off.", "FEATURE_INTAKE=true"],
  homeLinks: () => ['        <a className="button" href="/intake">Intake</a>'],
  navLinks: () => [{ href: "/intake", label: "Intake" }]
};
