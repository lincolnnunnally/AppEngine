import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDatabase } from "@/lib/db/client";
import type { AgentStructuredArtifact } from "./agent-artifacts";
import { buildGeneratedAppHandoff, type GeneratedAppHandoff } from "./app-output";
import { assertProjectBuildAllowed } from "./build-gate";
import { createLocalExport, getLocalProject, listLocalExports, listLocalRuns } from "./development-store";
import { isLocalMode } from "./local-mode";
import {
  composeModuleEnvLines,
  composeModuleFiles,
  composeModuleHomeLinks,
  composeModuleSchemaSql,
  composeModuleSeedSql
} from "./modules/registry";
import { analyzeIdea } from "./planner";
import {
  foundationEnvLines,
  foundationHomeLinks,
  foundationModuleFiles,
  foundationSchemaSql,
  foundationSeedSql
} from "./foundation-modules";
import { applyBrand, buildThemedCss, monogramFor, resolveTheme, type Brand } from "./themes";

type GeneratorProject = {
  id: string;
  name: string;
  idea: string;
  target_customer?: string | null;
  problem_statement?: string | null;
  revenue_model?: string | null;
  app_type?: string | null;
  plan?: ReturnType<typeof analyzeIdea>;
};

type GeneratedFile = {
  path: string;
  content: string;
};

type GeneratorAgentOutput = {
  agent: string;
  structuredArtifacts?: AgentStructuredArtifact[];
};

export async function listGeneratedAppExports(projectId: string) {
  if (isLocalMode()) {
    return {
      exports: await listLocalExports(projectId),
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const exports = await sql`
    select id, project_id, artifact_type, title, uri, metadata, created_at
    from artifacts
    where project_id = ${projectId}
      and artifact_type = 'generated_app_export'
    order by created_at desc
    limit 12
  `;

  return {
    exports,
    storage: "neon" as const
  };
}

export async function generateProjectApp(projectId: string, options: { themeId?: string; brand?: Brand } = {}) {
  await assertProjectBuildAllowed(projectId, "generate_project_app");
  if (isLocalMode()) {
    const project = await getLocalProject(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const exportResult = await writeGeneratedBundle(project, await getLatestAgentOutputs(projectId), options.themeId, options.brand);
    const generatedExport = await createLocalExport(projectId, exportResult);

    return {
      export: generatedExport,
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const [project] = await sql`
    select id, name, idea, target_customer, problem_statement, revenue_model, app_type
    from app_projects
    where id = ${projectId}
    limit 1
  `;

  if (!project) {
    throw new Error("Project not found");
  }

  const exportResult = await writeGeneratedBundle(project as GeneratorProject, await getLatestAgentOutputs(projectId), options.themeId, options.brand);
  const [artifact] = await sql`
    insert into artifacts (project_id, artifact_type, title, uri, metadata, content)
    values (
      ${projectId},
      'generated_app_export',
      'Generated App Bundle',
      ${exportResult.output_dir},
      ${JSON.stringify(exportResult.manifest)},
      ${exportResult.summary}
    )
    returning *
  `;

  await sql`
    update app_projects
    set status = 'app_exported',
      readiness_score = greatest(readiness_score, 86),
      updated_at = now()
    where id = ${projectId}
  `;

  await sql`
    insert into audit_events (project_id, event_type, event_data)
    values (${projectId}, 'project.app_exported', ${JSON.stringify({ artifactId: artifact.id, outputDir: exportResult.output_dir })})
  `;

  return {
    export: artifact,
    storage: "neon" as const
  };
}

async function writeGeneratedBundle(project: GeneratorProject, agentOutputs: GeneratorAgentOutput[] = [], themeId?: string, brand?: Brand) {
  const plan =
    project.plan ||
    analyzeIdea({
      idea: project.idea,
      targetCustomer: project.target_customer || undefined,
      problem: project.problem_statement || undefined,
      revenueModel: project.revenue_model || "Not sure yet",
      appType: project.app_type || "Auto detect"
    });
  const handoff = buildGeneratedAppHandoff(plan, agentOutputs);
  const safeSlug = slugify(project.name || plan.title || project.id);
  const outputDir = join(process.cwd(), ".app-engine", "generated-apps", `${project.id}-${safeSlug}`);
  const files = buildGeneratedFiles(project, plan, handoff, themeId, brand);

  for (const file of files) {
    const fullPath = join(outputDir, file.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, "utf8");
  }

  const manifest = {
    projectId: project.id,
    name: project.name,
    idea: project.idea,
    appType: plan.appType,
    recommendedTarget: plan.recommendedTarget,
    handoff,
    files: files.map((file) => file.path),
    generatedAt: new Date().toISOString()
  };

  await writeFile(join(outputDir, "app-engine-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    status: "app_exported",
    output_dir: outputDir,
    file_count: files.length + 1,
    summary: `Generated ${files.length + 1} files for ${project.name} using ${handoff.agentBlueprint.length} agent blueprint artifact${handoff.agentBlueprint.length === 1 ? "" : "s"}.`,
    manifest
  };
}

async function getLatestAgentOutputs(projectId: string): Promise<GeneratorAgentOutput[]> {
  if (isLocalMode()) {
    const runs = await listLocalRuns(projectId);
    const latestAgentRun = runs.find((run) => run.status === "agents_completed" || run.status === "agents_need_attention");

    return extractAgentOutputs(latestAgentRun);
  }

  const sql = getDatabase();
  const [run] = await sql`
    select output
    from agent_runs
    where project_id = ${projectId}
      and task_id is null
      and status in ('agents_completed', 'agents_need_attention')
    order by finished_at desc nulls last, created_at desc
    limit 1
  `;

  return extractAgentOutputs(run?.output);
}

function extractAgentOutputs(source: unknown): GeneratorAgentOutput[] {
  if (!source || typeof source !== "object") {
    return [];
  }

  const maybeAgents = "agents" in source ? (source as { agents?: unknown }).agents : undefined;

  if (!Array.isArray(maybeAgents)) {
    return [];
  }

  return maybeAgents
    .filter((agent): agent is { agent?: unknown; structuredArtifacts?: unknown } => Boolean(agent && typeof agent === "object"))
    .map((agent) => ({
      agent: typeof agent.agent === "string" ? agent.agent : "unknown",
      structuredArtifacts: Array.isArray(agent.structuredArtifacts) ? (agent.structuredArtifacts as AgentStructuredArtifact[]) : []
    }));
}

function buildGeneratedFiles(project: GeneratorProject, plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff, themeId?: string, brand?: Brand): GeneratedFile[] {
  const theme = applyBrand(resolveTheme(themeId, `${project.idea} ${plan.appType} ${plan.customer}`), brand);
  const rawName = project.name || plan.title || "Generated App";
  const projectName = escapeText(rawName);
  const monogram = monogramFor(rawName);
  const logoUrl = brand && typeof brand.logoUrl === "string" && /^https?:\/\//.test(brand.logoUrl.trim()) ? brand.logoUrl.trim() : "";
  const customer = escapeText(plan.customer);
  const problem = escapeText(plan.problem);
  const roleMatrix = normalizeRoleMatrix(handoff, plan.auth.roles);
  const roles = roleMatrix.map((role) => role.role);
  const protectedRoutes = normalizeProtectedRoutes(handoff);
  const apiRoutes = normalizeApiRoutes(handoff);
  const databaseModel = normalizeDatabaseModel(handoff);
  const qaChecks = normalizeQaChecks(handoff);
  const requiredEnvironment = extractRequiredEnvironment(handoff);
  const deploymentCommands = extractDeploymentCommands(handoff);
  const appData = buildAppSeedData(plan, handoff);
  const blueprint = {
    project: {
      id: project.id,
      name: projectName,
      idea: project.idea,
      customer,
      problem,
      appType: plan.appType,
      recommendedTarget: plan.recommendedTarget
    },
    handoff
  };
  const blueprintJson = JSON.stringify(blueprint, null, 2);

  return [
    {
      path: "package.json",
      content: `${JSON.stringify(
        {
          name: slugify(projectName),
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            typecheck: "tsc --noEmit",
            "db:setup": "node scripts/setup-database.mjs"
          },
          dependencies: {
            next: "^16.2.7",
            react: "^19.2.7",
            "react-dom": "^19.2.7",
            "@auth/pg-adapter": "latest",
            "next-auth": "5.0.0-beta.31",
            "@neondatabase/serverless": "latest"
          },
          devDependencies: {
            typescript: "latest",
            "@types/node": "latest",
            "@types/react": "latest",
            "@types/react-dom": "latest"
          },
          overrides: {
            postcss: "^8.5.10"
          }
        },
        null,
        2
      )}\n`
    },
    {
      path: "README.md",
      content: [
        `# ${projectName}`,
        "",
        `Customer: ${customer}`,
        `Problem: ${problem}`,
        `App type: ${plan.appType}`,
        `Target: ${plan.recommendedTarget}`,
        "",
        "## Run",
        "",
        "```bash",
        "npm install",
        "npm run typecheck",
        "npm run build",
        "npm run db:setup",
        "npm run dev",
        "```",
        "",
        "## Database Setup",
        "",
        "1. Copy `.env.example` to `.env.local`.",
        "2. Set `DATABASE_URL` to your Neon connection string.",
        "3. Set `AUTH_SECRET` and `APP_ENGINE_OWNER_EMAIL`.",
        "4. Run `npm run db:setup` to apply `src/lib/db/schema.sql` and `src/lib/db/seed.sql`.",
        "",
        "## Included Surfaces",
        "",
        "- Customer workspace",
        "- Guided onboarding",
        "- Account management",
        "- Billing and plans",
        "- Request tracking",
        "- Notification center",
        "- Admin customer management",
        "- Admin project queue",
        "- API stubs for customer/admin workflows",
        "- Machine-usable blueprint generated from agent artifacts",
        "",
        "## Generated Contracts",
        "",
        "- `src/lib/auth/permissions.ts` - role permissions and protected route gates",
        "- `src/lib/generated-api-contract.ts` - API route contracts from the backend agent",
        "- `src/lib/db/generated-model.ts` - database entities from the data agent",
        "- `src/lib/qa/acceptance-checks.ts` - launch checks from the QA agent",
        "- `src/lib/deployment/deployment-plan.ts` - env, commands, and release gates from the deployment agent"
      ].join("\n")
    },
    {
      path: "app-engine-blueprint.json",
      content: `${blueprintJson}\n`
    },
    {
      path: "next.config.mjs",
      content:
        'import { dirname } from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst root = dirname(fileURLToPath(import.meta.url));\n\n/** @type {import("next").NextConfig} */\nconst nextConfig = {\n  allowedDevOrigins: ["127.0.0.1"],\n  turbopack: {\n    root\n  }\n};\n\nexport default nextConfig;\n'
    },
    {
      path: "tsconfig.json",
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "react-jsx",
            incremental: false,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./src/*"]
            }
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
          exclude: ["node_modules", "tests"]
        },
        null,
        2
      )}\n`
    },
    {
      path: "next-env.d.ts",
      content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'
    },
    {
      path: ".env.example",
      content: [
        'DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/app?sslmode=require"',
        'AUTH_SECRET="replace-with-a-long-random-secret"',
        'AUTH_URL="http://localhost:3000"',
        'APP_ENGINE_OWNER_EMAIL="you@example.com"',
        'APP_ENGINE_STATS_TOKEN=""',
        ...composeModuleEnvLines(),
        'OPENAI_API_KEY=""',
        'ANTHROPIC_API_KEY=""',
        'VERCEL_TOKEN=""',
        'VERCEL_ORG_ID=""',
        'VERCEL_PROJECT_ID=""',
        ...foundationEnvLines()
      ].join("\n")
    },
    {
      path: "src/app/layout.tsx",
      content: `import "./styles.css";\nimport { AppShell } from "@/components/app-shell";\nimport { appBrand } from "@/lib/app-brand";\n\nexport const viewport = {\n  width: "device-width",\n  initialScale: 1,\n  themeColor: "${theme.paper}",\n  colorScheme: "${theme.mode}"\n};\n\nexport const metadata = {\n  title: { default: appBrand.name, template: "%s — " + appBrand.name },\n  description: appBrand.tagline,\n  icons: { icon: "/favicon.svg" },\n  openGraph: { title: appBrand.name, description: appBrand.tagline, type: "website" },\n  twitter: { card: "summary_large_image", title: appBrand.name, description: appBrand.tagline }\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        <AppShell>{children}</AppShell>\n      </body>\n    </html>\n  );\n}\n`
    },
    {
      path: "src/lib/app-brand.ts",
      content: `export const appBrand = ${JSON.stringify({ name: rawName, monogram, logoUrl, accent: theme.accent, accentInk: theme.accentInk, tagline: plan.valueProposition || plan.problem || "" }, null, 2)} as const;\n`
    },
    {
      path: "src/components/app-shell.tsx",
      content: `import { appBrand } from "@/lib/app-brand";\n\nconst NAV = [\n  { href: "/app", label: "App" },\n  { href: "/products", label: "Products" },\n  { href: "/support", label: "Support" },\n  { href: "/billing", label: "Billing" },\n  { href: "/account", label: "Account" },\n  { href: "/admin", label: "Admin" }\n];\n\nexport function AppShell({ children }: { children: React.ReactNode }) {\n  return (\n    <>\n      <header className="app-header">\n        <div className="app-header-inner">\n          <a className="app-brand" href="/">\n            {appBrand.logoUrl ? (\n              <img className="app-logo" src={appBrand.logoUrl} alt={appBrand.name} />\n            ) : (\n              <span className="app-logo-mark">{appBrand.monogram}</span>\n            )}\n            <span>{appBrand.name}</span>\n          </a>\n          <nav className="app-nav">\n            {NAV.map((item) => (\n              <a key={item.href} href={item.href}>{item.label}</a>\n            ))}\n            <a className="app-nav-cta" href="/sign-in">Sign in</a>\n          </nav>\n        </div>\n      </header>\n      {children}\n    </>\n  );\n}\n`
    },
    {
      path: "public/favicon.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${theme.accent}"/><text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="700" fill="${theme.accentInk}">${monogram}</text></svg>\n`
    },
    {
      path: "src/app/opengraph-image.tsx",
      content: `import { ImageResponse } from "next/og";\nimport { appBrand } from "@/lib/app-brand";\n\nexport const runtime = "edge";\nexport const size = { width: 1200, height: 630 };\nexport const contentType = "image/png";\n\nexport default function OgImage() {\n  return new ImageResponse(\n    (\n      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "${theme.paper}", color: "${theme.ink}", fontFamily: "sans-serif" }}>\n        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "96px", height: "96px", borderRadius: "20px", background: "${theme.accent}", color: "${theme.accentInk}", fontSize: "44px", fontWeight: 700 }}>{appBrand.monogram}</div>\n        <div style={{ fontSize: "64px", fontWeight: 700, marginTop: "40px" }}>{appBrand.name}</div>\n        <div style={{ fontSize: "30px", opacity: 0.8, marginTop: "16px" }}>{appBrand.tagline}</div>\n      </div>\n    ),\n    size\n  );\n}\n`
    },
    ...composeModuleFiles({ projectName, roles, roleMatrix, protectedRoutes }),
    {
      path: "src/lib/db/client.ts",
      content: `import { neon } from "@neondatabase/serverless";\n\nexport function hasDatabase() {\n  return Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("USER:PASSWORD@HOST"));\n}\n\nexport function getDatabase() {\n  if (!hasDatabase()) {\n    throw new Error("DATABASE_URL is required before using Neon persistence.");\n  }\n\n  return neon(process.env.DATABASE_URL!);\n}\n`
    },
    {
      path: "src/lib/db/queries.ts",
      content: `import { adminCustomers, adminProjects, customerRequests, notifications, pricingPlans } from "@/lib/app-data";\nimport { getDatabase, hasDatabase } from "./client";\n\ntype CustomerRequest = (typeof customerRequests)[number];\ntype Notification = (typeof notifications)[number];\ntype PricingPlan = (typeof pricingPlans)[number];\ntype AdminCustomer = (typeof adminCustomers)[number];\ntype AdminProject = (typeof adminProjects)[number];\n\nasync function withFallback<T>(fallback: T[], readRows: () => Promise<T[]>) {\n  if (!hasDatabase()) {\n    return fallback;\n  }\n\n  try {\n    const rows = await readRows();\n    return rows.length > 0 ? rows : fallback;\n  } catch (error) {\n    console.warn(\"Database read failed; using generated fallback data.\", error);\n    return fallback;\n  }\n}\n\nexport async function listCustomerRequests() {\n  return withFallback<CustomerRequest>(customerRequests, async () => {\n    const sql = getDatabase();\n    const rows = await sql\`select title, status, priority, summary from customer_requests order by created_at desc limit 20\`;\n\n    return rows.map((row) => ({\n      title: String(row.title),\n      status: String(row.status),\n      priority: String(row.priority),\n      summary: String(row.summary || \"\")\n    }));\n  });\n}\n\nexport async function listNotifications() {\n  return withFallback<Notification>(notifications, async () => {\n    const sql = getDatabase();\n    const rows = await sql\`select title, body, channel from notifications order by created_at desc limit 20\`;\n\n    return rows.map((row) => ({\n      title: String(row.title),\n      body: String(row.body),\n      channel: String(row.channel)\n    }));\n  });\n}\n\nexport async function listPricingPlans() {\n  return withFallback<PricingPlan>(pricingPlans, async () => {\n    const sql = getDatabase();\n    const rows = await sql\`select name, audience, price, includes from subscription_plans where active = true order by created_at asc limit 20\`;\n\n    return rows.map((row) => ({\n      name: String(row.name),\n      audience: String(row.audience || \"customers\"),\n      price: String(row.price),\n      includes: Array.isArray(row.includes) ? row.includes.map(String) : []\n    }));\n  });\n}\n\nexport async function listAdminCustomers() {\n  return withFallback<AdminCustomer>(adminCustomers, async () => {\n    const sql = getDatabase();\n    const rows = await sql\`\n      select organizations.name, count(customer_requests.id)::int as request_count\n      from organizations\n      left join customer_requests on customer_requests.organization_id = organizations.id\n      group by organizations.id, organizations.name\n      order by organizations.created_at asc\n      limit 20\n    \`;\n\n    return rows.map((row) => {\n      const requestCount = Number(row.request_count || 0);\n\n      return {\n        name: String(row.name),\n        health: requestCount > 3 ? \"watch\" : \"good\",\n        plan: \"Seed\",\n        status: requestCount > 0 ? requestCount + \" active requests\" : \"active\",\n        nextAction: requestCount > 0 ? \"Review request queue.\" : \"Invite another user.\"\n      };\n    });\n  });\n}\n\nexport async function listAdminProjects() {\n  return withFallback<AdminProject>(adminProjects, async () => {\n    const sql = getDatabase();\n    const rows = await sql\`select name, status, readiness_score, summary from app_projects order by updated_at desc limit 20\`;\n\n    return rows.map((row) => ({\n      name: String(row.name),\n      status: String(row.status),\n      readiness: Number(row.readiness_score || 0),\n      summary: String(row.summary || \"\")\n    }));\n  });\n}\n`
    },
    {
      path: "scripts/setup-database.mjs",
      content: `import { readFile } from "node:fs/promises";\nimport { dirname, join } from "node:path";\nimport { fileURLToPath } from "node:url";\nimport { neon } from "@neondatabase/serverless";\n\nconst rootDir = dirname(dirname(fileURLToPath(import.meta.url)));\n\nawait loadEnvFile(".env.local");\nawait loadEnvFile(".env");\n\nconst databaseUrl = process.env.DATABASE_URL;\n\nif (!databaseUrl || databaseUrl.includes("USER:PASSWORD@HOST")) {\n  console.error("DATABASE_URL must point to your Neon database before running setup.");\n  process.exit(1);\n}\n\nconst sql = neon(databaseUrl);\nconst files = ["src/lib/db/schema.sql", "src/lib/db/seed.sql"];\n\nfor (const file of files) {\n  const contents = await readFile(join(rootDir, file), "utf8");\n  const statements = splitSqlStatements(contents);\n\n  console.log("Applying " + file);\n\n  for (const statement of statements) {\n    await sql.query(statement);\n  }\n}\n\nconsole.log("Database setup complete.");\n\nfunction splitSqlStatements(contents) {\n  const statements = [];\n  let current = "";\n  let inSingleQuote = false;\n  let inDoubleQuote = false;\n  let previous = "";\n\n  for (const character of contents) {\n    current += character;\n\n    if (character === "'" && !inDoubleQuote && previous !== "\\\\") {\n      inSingleQuote = !inSingleQuote;\n    } else if (character === '"' && !inSingleQuote) {\n      inDoubleQuote = !inDoubleQuote;\n    } else if (character === ";" && !inSingleQuote && !inDoubleQuote) {\n      const statement = current.trim();\n\n      if (statement) {\n        statements.push(statement);\n      }\n\n      current = "";\n    }\n\n    previous = character;\n  }\n\n  const finalStatement = current.trim();\n\n  if (finalStatement) {\n    statements.push(finalStatement);\n  }\n\n  return statements;\n}\n\nasync function loadEnvFile(fileName) {\n  try {\n    const contents = await readFile(join(rootDir, fileName), "utf8");\n\n    for (const line of contents.split(/\\r?\\n/)) {\n      const match = line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)\\s*$/);\n\n      if (!match || line.trim().startsWith("#")) {\n        continue;\n      }\n\n      const [, key, rawValue] = match;\n      let value = rawValue.trim();\n\n      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {\n        value = value.slice(1, -1);\n      }\n\n      process.env[key] ??= value;\n    }\n  } catch (error) {\n    if (error?.code !== "ENOENT") {\n      throw error;\n    }\n  }\n}\n`
    },
    {
      path: "src/app/styles.css",
      content: buildThemedCss(theme)
    },
    {
      path: "src/app/page.tsx",
      content: `export default function HomePage() {\n  return (\n    <main className="shell hero">\n      <p className="eyebrow">${plan.appType}</p>\n      <h1>${projectName}</h1>\n      <p>${plan.valueProposition}</p>\n      <p className="note">Built for ${escapeText(plan.customer)}. ${escapeText(plan.problem)}</p>\n      <div className="action-row">\n        <a className="button primary" href="/app">Get started</a>\n        <a className="button" href="/onboarding">Onboarding</a>\n        <a className="button" href="/billing">Billing</a>\n${foundationHomeLinks()}\n${composeModuleHomeLinks()}\n        <a className="button" href="/admin">Admin</a>\n      </div>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/app/page.tsx",
      content: `import { customerMetrics, customerWorkflows, selectedModules } from "@/lib/app-data";\nimport { requireCustomerAccess } from "@/lib/auth/session";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function CustomerAppPage() {\n  const user = await requireCustomerAccess("/app");\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Customer Workspace</p>\n      <h1>${projectName}</h1>\n      <p>${customer} can manage the workflow for ${problem}.</p>\n      <p className="session-note">Signed in as {user.email} with {user.role} access.</p>\n      <section className="metric-grid">\n        {customerMetrics.map((metric) => (\n          <article className="metric-card" key={metric.label}>\n            <span>{metric.label}</span>\n            <strong>{metric.value}</strong>\n            <p>{metric.detail}</p>\n          </article>\n        ))}\n      </section>\n      <section className="grid">\n        {selectedModules.map((template) => (\n          <article className="card" key={template.name}>\n            <span>Module</span>\n            <strong>{template.name}</strong>\n            <p>{template.description}</p>\n          </article>\n        ))}\n      </section>\n      <section className="panel-list">\n        {customerWorkflows.map((workflow) => (\n          <article className="wide-card" key={workflow.title}>\n            <span>{workflow.status}</span>\n            <strong>{workflow.title}</strong>\n            <p>{workflow.nextAction}</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/account/page.tsx",
      content: `import { accountSections } from "@/lib/app-data";\nimport { requireCustomerAccess } from "@/lib/auth/session";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function AccountPage() {\n  const user = await requireCustomerAccess("/account");\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Account</p>\n      <h1>Customer Account</h1>\n      <p>Profile, organization, plan, billing, notification, and service usage controls.</p>\n      <p className="session-note">Managing account for {user.email}.</p>\n      <section className="grid">\n        {accountSections.map((section) => (\n          <article className="card" key={section.title}>\n            <span>{section.state}</span>\n            <strong>{section.title}</strong>\n            <p>{section.description}</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/onboarding/page.tsx",
      content: `import { onboardingSteps } from "@/lib/app-data";\nimport { requireCustomerAccess } from "@/lib/auth/session";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function OnboardingPage() {\n  await requireCustomerAccess("/onboarding");\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Onboarding</p>\n      <h1>Guided Setup</h1>\n      <p>Capture the customer's goal, company context, success criteria, and first useful workflow.</p>\n      <section className="panel-list">\n        {onboardingSteps.map((step) => (\n          <article className="wide-card" key={step.title}>\n            <span>{step.status}</span>\n            <strong>{step.title}</strong>\n            <p>{step.description}</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/billing/page.tsx",
      content: `import { requireCustomerAccess } from "@/lib/auth/session";\nimport { listPricingPlans } from "@/lib/db/queries";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function BillingPage() {\n  await requireCustomerAccess("/billing");\n  const plans = await listPricingPlans();\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Billing</p>\n      <h1>Plans And Usage</h1>\n      <p>Subscription state, usage limits, invoices, and upgrade triggers.</p>\n      <section className="grid">\n        {plans.map((plan) => (\n          <article className="card" key={plan.name}>\n            <span>{plan.audience}</span>\n            <strong>{plan.name}</strong>\n            <p>{plan.price}</p>\n            <small>{plan.includes.join(" | ")}</small>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/requests/page.tsx",
      content: `import { requireCustomerAccess } from "@/lib/auth/session";\nimport { listCustomerRequests } from "@/lib/db/queries";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function RequestsPage() {\n  await requireCustomerAccess("/requests");\n  const requests = await listCustomerRequests();\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Requests</p>\n      <h1>Customer Requests</h1>\n      <p>Track intake, priority, owner, status, and next recovery step.</p>\n      <section className="panel-list">\n        {requests.map((request) => (\n          <article className="wide-card" key={request.title}>\n            <span>{request.status}</span>\n            <strong>{request.title}</strong>\n            <p>{request.summary}</p>\n            <small>{request.priority} priority</small>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/notifications/page.tsx",
      content: `import { requireCustomerAccess } from "@/lib/auth/session";\nimport { listNotifications } from "@/lib/db/queries";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function NotificationsPage() {\n  await requireCustomerAccess("/notifications");\n  const messages = await listNotifications();\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Notifications</p>\n      <h1>Message Center</h1>\n      <p>In-app and email notifications for workflow updates, risk, opportunities, and account events.</p>\n      <section className="panel-list">\n        {messages.map((notification) => (\n          <article className="wide-card" key={notification.title}>\n            <span>{notification.channel}</span>\n            <strong>{notification.title}</strong>\n            <p>{notification.body}</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/admin/page.tsx",
      content: `import { adminMetrics, adminQueues } from "@/lib/app-data";\nimport { requireAdminAccess } from "@/lib/auth/session";\nimport { roles } from "@/lib/auth/roles";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function AdminPage() {\n  const user = await requireAdminAccess("/admin");\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Admin</p>\n      <h1>Admin Console</h1>\n      <p>Manage customers, projects, agent runs, QA reports, deployments, support, and audit logs.</p>\n      <p className="session-note">Admin access granted for {user.email}.</p>\n      <section className="metric-grid">\n        {adminMetrics.map((metric) => (\n          <article className="metric-card" key={metric.label}>\n            <span>{metric.label}</span>\n            <strong>{metric.value}</strong>\n            <p>{metric.detail}</p>\n          </article>\n        ))}\n      </section>\n      <section className="grid">\n        {roles.map((role) => (\n          <article className="card" key={role}>\n            <span>Role</span>\n            <strong>{role}</strong>\n            <p>Access policy should be enforced on matching routes and APIs.</p>\n          </article>\n        ))}\n      </section>\n      <section className="panel-list">\n        {adminQueues.map((queue) => (\n          <article className="wide-card" key={queue.title}>\n            <span>{queue.status}</span>\n            <strong>{queue.title}</strong>\n            <p>{queue.nextAction}</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/admin/customers/page.tsx",
      content: `import { requireAdminAccess } from "@/lib/auth/session";\nimport { listAdminCustomers } from "@/lib/db/queries";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function AdminCustomersPage() {\n  await requireAdminAccess("/admin/customers");\n  const customers = await listAdminCustomers();\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Admin</p>\n      <h1>Customers</h1>\n      <p>Customer health, plan, request load, support state, and expansion opportunities.</p>\n      <section className="panel-list">\n        {customers.map((customer) => (\n          <article className="wide-card" key={customer.name}>\n            <span>{customer.health}</span>\n            <strong>{customer.name}</strong>\n            <p>{customer.plan} plan - {customer.status}</p>\n            <small>{customer.nextAction}</small>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/admin/projects/page.tsx",
      content: `import { requireAdminAccess } from "@/lib/auth/session";\nimport { listAdminProjects } from "@/lib/db/queries";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function AdminProjectsPage() {\n  await requireAdminAccess("/admin/projects");\n  const projects = await listAdminProjects();\n\n  return (\n    <main className="shell">\n      <p className="eyebrow">Admin</p>\n      <h1>Generated App Projects</h1>\n      <p>Agent status, QA state, deployment state, and customer handoff readiness.</p>\n      <section className="panel-list">\n        {projects.map((project) => (\n          <article className="wide-card" key={project.name}>\n            <span>{project.status}</span>\n            <strong>{project.name}</strong>\n            <p>{project.summary}</p>\n            <small>{project.readiness}% readiness</small>\n          </article>\n        ))}\n      </section>\n    </main>\n  );\n}\n`
    },
    {
      path: "src/app/api/health/route.ts",
      content: `import { NextResponse } from "next/server";\n\nexport async function GET() {\n  return NextResponse.json({ ok: true, app: "${projectName}" });\n}\n`
    },
    {
      path: "src/app/api/customer/requests/route.ts",
      content: `import { NextResponse } from "next/server";\nimport { canAccessCustomerArea } from "@/lib/auth/roles";\nimport { getCurrentUser } from "@/lib/auth/session";\nimport { listCustomerRequests } from "@/lib/db/queries";\n\nexport async function GET() {\n  const user = await getCurrentUser();\n\n  if (!canAccessCustomerArea(user?.role)) {\n    return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n  }\n\n  return NextResponse.json({ user, requests: await listCustomerRequests() });\n}\n`
    },
    {
      path: "src/app/api/admin/customers/route.ts",
      content: `import { NextResponse } from "next/server";\nimport { canAccessAdmin } from "@/lib/auth/roles";\nimport { getCurrentUser } from "@/lib/auth/session";\nimport { listAdminCustomers } from "@/lib/db/queries";\n\nexport async function GET() {\n  const user = await getCurrentUser();\n\n  if (!user) {\n    return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n  }\n\n  if (!canAccessAdmin(user.role)) {\n    return NextResponse.json({ error: "Admin access required" }, { status: 403 });\n  }\n\n  return NextResponse.json({ user, customers: await listAdminCustomers() });\n}\n`
    },
    {
      path: "src/app/api/admin/projects/route.ts",
      content: `import { NextResponse } from "next/server";\nimport { canAccessAdmin } from "@/lib/auth/roles";\nimport { getCurrentUser } from "@/lib/auth/session";\nimport { listAdminProjects } from "@/lib/db/queries";\n\nexport async function GET() {\n  const user = await getCurrentUser();\n\n  if (!user) {\n    return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n  }\n\n  if (!canAccessAdmin(user.role)) {\n    return NextResponse.json({ error: "Admin access required" }, { status: 403 });\n  }\n\n  return NextResponse.json({ user, projects: await listAdminProjects() });\n}\n`
    },
    {
      path: "src/lib/db/schema.sql",
      content: buildSchemaSql()
    },
    {
      path: "src/lib/db/seed.sql",
      content: buildSeedSql(projectName, customer, problem, appData)
    },
    {
      path: "src/lib/templates/index.ts",
      content: `export const selectedTemplates = ${JSON.stringify(plan.templates, null, 2)};\n`
    },
    {
      path: "src/lib/generated-blueprint.ts",
      content: `export const generatedBlueprint = ${blueprintJson} as const;\n`
    },
    {
      path: "src/lib/generated-api-contract.ts",
      content: `export const generatedApiRoutes = ${JSON.stringify(apiRoutes, null, 2)} as const;\n\nexport type GeneratedApiRoute = (typeof generatedApiRoutes)[number];\n\nexport function getApiRoute(path: string, method?: string) {\n  const normalizedMethod = method?.toUpperCase();\n\n  return generatedApiRoutes.find((route) => route.path === path && (!normalizedMethod || route.method === normalizedMethod));\n}\n\nexport function apiRoutesForAuth(auth: string) {\n  return generatedApiRoutes.filter((route) => route.auth === auth);\n}\n`
    },
    {
      path: "src/lib/db/generated-model.ts",
      content: `export const generatedDatabaseModel = ${JSON.stringify(databaseModel, null, 2)} as const;\n\nexport type GeneratedEntity = (typeof generatedDatabaseModel)[number];\nexport type GeneratedEntityName = GeneratedEntity["name"];\n\nexport function fieldsForEntity(entityName: string) {\n  const entity = generatedDatabaseModel.find((candidate) => candidate.name === entityName);\n\n  return entity ? [...(entity.fields as readonly string[])] : [];\n}\n\nexport function indexesForEntity(entityName: string) {\n  const entity = generatedDatabaseModel.find((candidate) => candidate.name === entityName);\n\n  return entity ? [...(entity.indexes as readonly string[])] : [];\n}\n`
    },
    {
      path: "src/lib/qa/acceptance-checks.ts",
      content: `export const acceptanceChecks = ${JSON.stringify(qaChecks, null, 2)} as const;\n\nexport const qaEvidence = ${JSON.stringify(extractQaEvidence(handoff), null, 2)} as const;\n\nexport type AcceptanceCheck = (typeof acceptanceChecks)[number];\n\nexport function launchBlockingChecks() {\n  return acceptanceChecks.filter((check) => check.severity === "high");\n}\n\nexport function commandsToRun() {\n  return acceptanceChecks.map((check) => check.command).filter(Boolean);\n}\n`
    },
    {
      path: "src/lib/deployment/deployment-plan.ts",
      content: `export const requiredEnvironment = ${JSON.stringify(requiredEnvironment, null, 2)} as const;\n\nexport const deploymentCommands = ${JSON.stringify(deploymentCommands, null, 2)} as const;\n\nexport const deploymentGates = ${JSON.stringify(handoff.deploymentGates, null, 2)} as const;\n\nexport function missingRequiredEnvironment(env: NodeJS.ProcessEnv = process.env) {\n  return requiredEnvironment.filter((key) => !env[key] || env[key]?.includes("replace"));\n}\n\nexport function isReadyForPreview(env: NodeJS.ProcessEnv = process.env) {\n  return missingRequiredEnvironment(env).length === 0;\n}\n`
    },
    {
      path: "src/lib/app-data.ts",
      content: `export const selectedModules = ${JSON.stringify(appData.selectedModules, null, 2)};

export const customerMetrics = ${JSON.stringify(appData.customerMetrics, null, 2)};

export const customerWorkflows = ${JSON.stringify(appData.customerWorkflows, null, 2)};

export const accountSections = ${JSON.stringify(appData.accountSections, null, 2)};

export const onboardingSteps = ${JSON.stringify(appData.onboardingSteps, null, 2)};

export const pricingPlans = ${JSON.stringify(appData.pricingPlans, null, 2)};

export const customerRequests = ${JSON.stringify(appData.customerRequests, null, 2)};

export const notifications = ${JSON.stringify(appData.notifications, null, 2)};

export const adminMetrics = ${JSON.stringify(appData.adminMetrics, null, 2)};

export const adminQueues = ${JSON.stringify(appData.adminQueues, null, 2)};

export const adminCustomers = ${JSON.stringify(appData.adminCustomers, null, 2)};

export const adminProjects = ${JSON.stringify(appData.adminProjects, null, 2)};
`
    },
    {
      path: "tests/e2e/customer-admin.spec.ts",
      content: `import { test, expect } from "@playwright/test";\n\ntest("customer and admin surfaces load", async ({ page }) => {\n  await page.goto("/app");\n  await expect(page.getByText("${projectName}")).toBeVisible();\n  await page.goto("/admin");\n  await expect(page.getByText("Admin Console")).toBeVisible();\n});\n`
    },
    {
      path: "vercel.json",
      content: `${JSON.stringify({ framework: "nextjs", buildCommand: "npm run build" }, null, 2)}\n`
    },
    ...foundationModuleFiles()
  ];
}

type RolePermission = {
  role: string;
  can: string[];
};

type ProtectedRouteGate = {
  path: string;
  access: string[];
};

type ApiRouteContract = {
  method: string;
  path: string;
  purpose: string;
  auth: string;
};

type DatabaseEntity = {
  name: string;
  purpose: string;
  fields: string[];
  indexes: string[];
};

type QaCheck = {
  title: string;
  severity: string;
  command: string;
};

function buildAppSeedData(plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff) {
  return {
    selectedModules: buildSelectedModules(plan, handoff),
    customerMetrics: [
      { label: "Open work", value: "8", detail: "Active customer-facing items needing action." },
      { label: "Time saved", value: "14h", detail: "Estimated monthly time recovered from automation." },
      { label: "Plan usage", value: "62%", detail: "Current usage against plan limits." },
      { label: "Health", value: "Good", detail: "Account has no critical blockers." }
    ],
    customerWorkflows: buildCustomerWorkflows(plan, handoff),
    accountSections: [
      { title: "Profile", state: "ready", description: "Customer name, email, role, avatar, and preferences." },
      { title: "Organization", state: "ready", description: "Company details, members, permissions, and ownership." },
      { title: "Billing", state: "ready", description: "Subscription, invoices, usage, plan limits, and upgrade path." },
      { title: "Notifications", state: "ready", description: "Email and in-app delivery preferences." }
    ],
    onboardingSteps: buildOnboardingSteps(handoff),
    pricingPlans: buildPricingPlans(handoff),
    customerRequests: buildCustomerRequests(plan, handoff),
    notifications: [
      { title: "Workflow completed", channel: "in-app", body: "Notify the customer when their primary workflow reaches success." },
      { title: "Action required", channel: "email", body: "Escalate blocked work with a direct recovery action." },
      { title: "Upgrade opportunity", channel: "in-app", body: "Prompt upgrade when value and usage justify expansion." }
    ],
    adminMetrics: [
      { label: "Customers", value: "24", detail: "Accounts in the current workspace." },
      { label: "At risk", value: "3", detail: "Customers needing support or onboarding help." },
      { label: "MRR", value: "$8.2k", detail: "Monthly recurring revenue snapshot." },
      { label: "Deployments", value: "6", detail: "Preview or production releases this month." }
    ],
    adminQueues: buildAdminQueues(handoff),
    adminCustomers: [
      { name: "Acme Services", health: "good", plan: "Growth", status: "active", nextAction: "Invite second admin user." },
      { name: "Northstar Ops", health: "watch", plan: "Starter", status: "setup incomplete", nextAction: "Finish onboarding checklist." },
      { name: "Atlas Field", health: "expansion", plan: "Growth", status: "near usage limit", nextAction: "Offer Scale upgrade." }
    ],
    adminProjects: buildAdminProjects(plan, handoff)
  };
}

function buildSelectedModules(plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff) {
  const templateData = artifactData(handoff, "template_plan");
  const contracts = records(templateData.moduleContracts);
  const selectedNames = uniqueStrings(strings(templateData.selectedTemplates, plan.templates.map((template) => template.name)));

  return selectedNames.map((name) => {
    const plannedTemplate = plan.templates.find((template) => template.name === name);
    const contract = contracts.find((item) => text(item.name, "") === name);
    const includes = strings(contract?.includes, []);

    return {
      name,
      category: plannedTemplate?.category || "generated module",
      description:
        plannedTemplate?.description ||
        (includes.length ? `Includes ${includes.join(", ")}.` : `Reusable ${name} module generated by the template agent.`)
    };
  });
}

function buildCustomerWorkflows(plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff) {
  const workflows = normalizeWorkflows(handoff);
  const statuses = ["active", "ready", "watching", "queued"];

  if (!workflows.length) {
    return [
      { title: "First outcome workflow", status: "active", nextAction: `Move the customer through the ${plan.problem} workflow.` },
      { title: "Recovery path", status: "ready", nextAction: "Show blocked items, support escalation, and next best action." },
      { title: "Expansion signal", status: "watching", nextAction: "Track usage and trigger upgrade when limits are approached." }
    ];
  }

  return workflows.slice(0, 4).map((workflow, index) => ({
    title: workflow.name,
    status: statuses[index] || "ready",
    nextAction: workflow.steps.length
      ? `Next step: ${workflow.steps[0]}. Path: ${workflow.steps.join(" -> ")}.`
      : `Move the customer through the ${plan.problem} workflow.`
  }));
}

function buildOnboardingSteps(handoff: GeneratedAppHandoff) {
  const onboardingWorkflow = normalizeWorkflows(handoff).find((workflow) => workflow.name.toLowerCase().includes("onboarding"));
  const steps = onboardingWorkflow?.steps.length
    ? onboardingWorkflow.steps
    : ["capture goal", "company setup", "first workflow", "success criteria"];

  return steps.map((step, index) => ({
    title: toTitle(step),
    status: `step ${index + 1}`,
    description: `Complete ${step} so the account reaches first value.`
  }));
}

function buildPricingPlans(handoff: GeneratedAppHandoff) {
  const tiers = records(artifactData(handoff, "business_model").pricingTiers);
  const fallbackAudiences = ["new customers", "scaling teams", "operators"];

  if (!tiers.length) {
    return [
      { name: "Starter", audience: "new customers", price: "$49/mo", includes: ["1 workspace", "basic automations", "email support"] },
      { name: "Growth", audience: "scaling teams", price: "$149/mo", includes: ["5 workspaces", "AI runs", "priority support"] },
      { name: "Scale", audience: "operators", price: "$399/mo", includes: ["unlimited workflows", "admin controls", "SLA support"] }
    ];
  }

  return tiers.map((tier, index) => {
    const includes = uniqueStrings([
      ...strings(tier.includes, []),
      text(tier.limit, ""),
      text(tier.upgradeTrigger, "")
    ]);

    return {
      name: text(tier.name, `Plan ${index + 1}`),
      audience: text(tier.audience, fallbackAudiences[index] || "customers"),
      price: text(tier.price, "Custom"),
      includes: includes.length ? includes : ["core workflow", "account workspace", "support"]
    };
  });
}

function buildCustomerRequests(plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff) {
  const workflows = normalizeWorkflows(handoff);
  const statuses = ["open", "in progress", "waiting"];
  const priorities = ["high", "medium", "medium"];

  if (!workflows.length) {
    return [
      { title: "Complete setup", status: "open", priority: "high", summary: "Customer needs onboarding steps finished before first value." },
      { title: "Review workflow", status: "in progress", priority: "medium", summary: "Customer submitted a workflow for admin review." },
      { title: "Upgrade limit", status: "waiting", priority: "medium", summary: "Usage is approaching the plan limit and needs a decision." }
    ];
  }

  return workflows.slice(0, 3).map((workflow, index) => ({
    title: workflow.name,
    status: statuses[index] || "open",
    priority: priorities[index] || "medium",
    summary: workflow.steps.length
      ? `${plan.customer} is at ${workflow.steps[0]} and needs the next guided action.`
      : `${plan.customer} needs help with ${plan.problem}.`
  }));
}

function buildAdminQueues(handoff: GeneratedAppHandoff) {
  const qaChecks = normalizeQaChecks(handoff);
  const launchBlockingCheck = qaChecks.find((check) => check.severity === "high") || qaChecks[0];
  const deploymentGate = handoff.deploymentGates[0] || "env configured";

  return [
    { title: "Customer onboarding", status: "attention", nextAction: "Review incomplete onboarding and send next action." },
    {
      title: launchBlockingCheck ? `QA: ${launchBlockingCheck.title}` : "QA findings",
      status: launchBlockingCheck?.severity || "active",
      nextAction: launchBlockingCheck?.command ? `Run ${launchBlockingCheck.command}.` : "Patch unresolved checks before production promotion."
    },
    {
      title: "Deployment queue",
      status: "blocked",
      nextAction: `Clear gate: ${deploymentGate}.`
    }
  ];
}

function buildAdminProjects(plan: ReturnType<typeof analyzeIdea>, handoff: GeneratedAppHandoff) {
  const readiness = Math.min(96, 72 + Math.min(handoff.agentBlueprint.length, 12));

  return [
    {
      name: plan.title || "Generated App",
      status: "qa",
      readiness,
      summary: `Agent run produced ${handoff.agentBlueprint.length} usable artifacts and ${handoff.qaChecks.length} QA checks.`
    },
    {
      name: "Data Model",
      status: "ready",
      readiness: handoff.databaseModel.length ? 82 : 42,
      summary: `${handoff.databaseModel.length || 0} entities ready for Neon setup.`
    },
    {
      name: "Preview Deployment",
      status: handoff.deploymentGates.length ? "gated" : "ready",
      readiness: handoff.deploymentGates.length ? 68 : 90,
      summary: `${handoff.deploymentGates.length || 0} release gates must pass before promotion.`
    }
  ];
}

function normalizeRoleMatrix(handoff: GeneratedAppHandoff, fallbackRoles: string[]): RolePermission[] {
  const source = handoff.roleMatrix.length
    ? handoff.roleMatrix
    : fallbackRoles.map((role) => ({ role, can: role === "customer" ? ["manage own account"] : ["manage app operations"] }));
  const roleMap = new Map<string, RolePermission>();

  for (const role of source) {
    const roleName = text(role.role, "");

    if (!roleName) {
      continue;
    }

    roleMap.set(roleName, {
      role: roleName,
      can: strings(role.can, roleName === "customer" ? ["manage own account"] : ["manage app operations"])
    });
  }

  for (const fallbackRole of ["owner", "admin", "customer"]) {
    if (!roleMap.has(fallbackRole)) {
      roleMap.set(fallbackRole, {
        role: fallbackRole,
        can: fallbackRole === "customer" ? ["manage own account"] : ["manage app operations"]
      });
    }
  }

  return Array.from(roleMap.values());
}

function normalizeProtectedRoutes(handoff: GeneratedAppHandoff): ProtectedRouteGate[] {
  const source = records(artifactData(handoff, "auth_plan").protectedRoutes);
  const fallback = [
    { path: "/app", access: ["owner", "admin", "customer"] },
    { path: "/account", access: ["owner", "admin", "customer"] },
    { path: "/admin", access: ["owner", "admin"] },
    { path: "/api/customer/*", access: ["owner", "admin", "customer"] },
    { path: "/api/admin/*", access: ["owner", "admin"] }
  ];
  const routes = source.length ? source : fallback;
  const routeMap = new Map<string, ProtectedRouteGate>();

  for (const route of routes) {
    const path = text(route.path, "");

    if (!path) {
      continue;
    }

    routeMap.set(path, {
      path,
      access: strings(route.access, ["owner", "admin", "customer"])
    });
  }

  return Array.from(routeMap.values());
}

function normalizeApiRoutes(handoff: GeneratedAppHandoff): ApiRouteContract[] {
  return (handoff.apiRoutes.length
    ? handoff.apiRoutes
    : [
        { method: "GET", path: "/api/health", purpose: "public health check", auth: "public" },
        { method: "GET", path: "/api/customer/requests", purpose: "list customer requests", auth: "customer" },
        { method: "GET", path: "/api/admin/customers", purpose: "list admin customers", auth: "admin" },
        { method: "GET", path: "/api/admin/projects", purpose: "list admin projects", auth: "admin" },
        { method: "GET", path: "/api/admin/stats", purpose: "ops stats for the AppEngine owner dashboard", auth: "stats token" }
      ]
  ).map((route) => ({
    method: text(route.method, "GET").toUpperCase(),
    path: text(route.path, "/api/health"),
    purpose: text(route.purpose, "generated API route"),
    auth: text(route.auth, "public")
  }));
}

function normalizeDatabaseModel(handoff: GeneratedAppHandoff): DatabaseEntity[] {
  return (handoff.databaseModel.length ? handoff.databaseModel : [{ name: "organizations", purpose: "Customer organizations", fields: ["name"], indexes: ["slug"] }]).map(
    (entity) => ({
      name: text(entity.name, "generated_entity"),
      purpose: text(entity.purpose, "Generated data entity"),
      fields: strings(entity.fields, []),
      indexes: strings(entity.indexes, [])
    })
  );
}

function normalizeQaChecks(handoff: GeneratedAppHandoff): QaCheck[] {
  return (handoff.qaChecks.length
    ? handoff.qaChecks
    : [
        { title: "typecheck", severity: "high", command: "npm run typecheck" },
        { title: "production build", severity: "high", command: "npm run build" }
      ]
  ).map((check) => ({
    title: text(check.title, "Generated QA check"),
    severity: text(check.severity, "medium"),
    command: text(check.command, "")
  }));
}

function normalizeWorkflows(handoff: GeneratedAppHandoff) {
  return handoff.workflows.map((workflow) => ({
    name: text(workflow.name, "Generated workflow"),
    steps: strings(workflow.steps, [])
  }));
}

function extractRequiredEnvironment(handoff: GeneratedAppHandoff) {
  const deploymentData = artifactData(handoff, "deployment_plan");
  const fallbackEnvironment = handoff.environment.flatMap((item) => item.split(/\s+or\s+/i).map((name) => name.trim()));

  return uniqueStrings(strings(deploymentData.requiredEnv, fallbackEnvironment)).filter((item) => /^[A-Z0-9_]+$/.test(item));
}

function extractDeploymentCommands(handoff: GeneratedAppHandoff) {
  return uniqueStrings(strings(artifactData(handoff, "deployment_plan").commands, handoff.deployment));
}

function extractQaEvidence(handoff: GeneratedAppHandoff) {
  return uniqueStrings(strings(artifactData(handoff, "qa_plan").evidence, ["build logs", "API responses", "browser screenshots"]));
}

function artifactData(handoff: GeneratedAppHandoff, kind: string) {
  return handoff.agentBlueprint.find((artifact) => artifact.kind === kind)?.data || {};
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function strings(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? (value as string[]) : fallback;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function toTitle(input: string) {
  return input
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildSchemaSql() {
  return `create extension if not exists pgcrypto;

create table if not exists verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,
  primary key (identifier, token)
);

create table if not exists users (
  id serial primary key,
  name varchar(255),
  email varchar(255) unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists accounts (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
  type varchar(255) not null,
  provider varchar(255) not null,
  "providerAccountId" varchar(255) not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text
);

create table if not exists sessions (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" varchar(255) not null unique
);

create table if not exists app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id integer not null references users(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auth_user_id)
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table if not exists app_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  name text not null,
  summary text,
  customer_goal text,
  status text not null default 'planned',
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  created_by_user_id integer references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists app_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  agent_name text not null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  agent_run_id uuid references agent_runs(id) on delete set null,
  artifact_type text not null,
  title text not null,
  content text,
  uri text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists qa_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  title text not null,
  status text not null default 'pending',
  severity text not null default 'medium',
  details text,
  reproduction_steps jsonb not null default '[]'::jsonb,
  evidence_artifact_id uuid references artifacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  provider text not null default 'vercel',
  environment text not null default 'preview',
  status text not null default 'queued',
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists customer_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by_user_id integer references users(id) on delete set null,
  title text not null,
  summary text,
  priority text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique(organization_id, title)
);

create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price text not null,
  audience text,
  includes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id integer references users(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null default 'in-app',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id, title)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id integer references users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users(email);
create index if not exists accounts_user_idx on accounts("userId");
create index if not exists accounts_provider_account_idx on accounts(provider, "providerAccountId");
create index if not exists sessions_user_idx on sessions("userId");

-- Ops reporting: a join timestamp so the owner dashboard can show new-user growth
-- (who joined this week vs last). Added by ALTER, not in the CREATE, so it applies
-- uniformly to apps built before this shipped. Existing rows stay NULL (join date
-- unknown) instead of backfilling to now() — that would fake a "everyone joined
-- this week" spike. New sign-ups get now() via the default. NextAuth's pg-adapter
-- never sets this column, so the default always fills it.
alter table users add column if not exists created_at timestamptz;
alter table users alter column created_at set default now();
create index if not exists users_created_at_idx on users(created_at);
create index if not exists app_user_profiles_role_idx on app_user_profiles(role);
create index if not exists organizations_owner_idx on organizations(owner_user_id);
create index if not exists organization_memberships_user_idx on organization_memberships(user_id);
create index if not exists app_projects_org_status_idx on app_projects(organization_id, status);
create index if not exists app_tasks_project_status_idx on app_tasks(project_id, status);
create index if not exists agent_runs_project_status_idx on agent_runs(project_id, status);
create index if not exists artifacts_project_type_idx on artifacts(project_id, artifact_type);
create index if not exists qa_checks_project_status_idx on qa_checks(project_id, status);
create index if not exists deployments_project_environment_idx on deployments(project_id, environment);
create index if not exists customer_requests_org_status_idx on customer_requests(organization_id, status);
create index if not exists notifications_org_read_idx on notifications(organization_id, read_at);
create index if not exists audit_events_org_idx on audit_events(organization_id, created_at desc);
` + foundationSchemaSql() + "\n" + composeModuleSchemaSql() + "\n";
}

function buildSeedSql(
  projectName: string,
  customer: string,
  problem: string,
  appData: ReturnType<typeof buildAppSeedData>
) {
  const templateRows = appData.selectedModules
    .map(
      (template) =>
        `(${sqlString(slugify(template.name))}, ${sqlString(template.name)}, ${sqlString(template.category)}, ${sqlString(template.description)}, '{}'::jsonb)`
    )
    .join(",\n");
  const planRows = appData.pricingPlans
    .map(
      (plan) =>
        `(${sqlString(plan.name)}, ${sqlString(plan.audience)}, ${sqlString(plan.price)}, ${sqlString(JSON.stringify(plan.includes))}::jsonb)`
    )
    .join(",\n");
  const requestRows = appData.customerRequests
    .map(
      (request) =>
        `(${sqlString(request.title)}, ${sqlString(request.summary)}, ${sqlString(request.priority)}, ${sqlString(request.status)})`
    )
    .join(",\n");
  const notificationRows = appData.notifications
    .map(
      (notification) =>
        `(${sqlString(notification.title)}, ${sqlString(notification.body)}, ${sqlString(notification.channel)})`
    )
    .join(",\n");
  const projectRows = appData.adminProjects
    .map(
      (project) =>
        `(${sqlString(project.name)}, ${sqlString(project.summary)}, ${sqlString(project.status)}, ${project.readiness})`
    )
    .join(",\n");

  return `insert into organizations (name, slug)
values (${sqlString(`${projectName} Demo Organization`)}, 'demo-organization')
on conflict (slug) do update set name = excluded.name;

insert into app_templates (slug, name, category, description, config)
values
${templateRows}
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  config = excluded.config;

insert into subscription_plans (name, audience, price, includes)
values
${planRows}
on conflict (name) do update set
  audience = excluded.audience,
  price = excluded.price,
  includes = excluded.includes,
  active = true;

with seed_org as (
  select id from organizations where slug = 'demo-organization'
)
insert into customer_requests (organization_id, title, summary, priority, status)
select seed_org.id, request_data.title, request_data.summary, request_data.priority, request_data.status
from seed_org
cross join (
  values
${requestRows}
) as request_data(title, summary, priority, status)
on conflict (organization_id, title) do update set
  summary = excluded.summary,
  priority = excluded.priority,
  status = excluded.status;

with seed_org as (
  select id from organizations where slug = 'demo-organization'
)
insert into notifications (organization_id, title, body, channel)
select seed_org.id, notification_data.title, notification_data.body, notification_data.channel
from seed_org
cross join (
  values
${notificationRows}
) as notification_data(title, body, channel)
on conflict (organization_id, title) do update set
  body = excluded.body,
  channel = excluded.channel;

with seed_org as (
  select id from organizations where slug = 'demo-organization'
)
insert into app_projects (organization_id, name, summary, customer_goal, status, readiness_score)
select seed_org.id, project_data.name, project_data.summary, ${sqlString(`Target customer: ${customer}. Problem: ${problem}.`)}, project_data.status, project_data.readiness_score
from seed_org
cross join (
  values
${projectRows}
) as project_data(name, summary, status, readiness_score)
on conflict (organization_id, name) do update set
  summary = excluded.summary,
  customer_goal = excluded.customer_goal,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  updated_at = now();
` + foundationSeedSql() + "\n" + composeModuleSeedSql() + "\n";
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "generated-app";
}

function escapeText(input: string) {
  return input.replace(/[<>]/g, "");
}

function sqlString(input: string) {
  return `'${input.replace(/'/g, "''")}'`;
}
