import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// E2E composition gate: compose a REAL app selection (foundation modules + the
// optional modules named on the command line, default purpose-onboarding +
// payments-billing), write the emitted files to disk exactly as the generator
// would, and typecheck the composed app with the generated tsconfig. This
// catches what the per-module smoke cannot: cross-file breakage in the code the
// modules actually emit (a page importing a helper another module renamed, JSX
// that doesn't parse, etc.). Requires node >= 22.6 (imports .ts via type
// stripping, like scripts/smoke-modules-registry.js).
// Run: node scripts/e2e-compose-selection.mjs [slug ...]

const root = process.cwd();
const outDir = path.join(root, ".app-engine", "e2e-compose-selection");
const selectedSlugs = process.argv.slice(2);
const selected = new Set(selectedSlugs.length ? selectedSlugs : ["purpose-onboarding", "payments-billing"]);

// Discover modules by importing each module file directly (registry.ts uses
// extensionless imports node's type stripping cannot resolve) — same approach as
// scripts/smoke-modules-registry.js, which also guarantees every discovered
// module is registered, so this set matches the registry.
const modulesDir = path.join(root, "src/lib/engine/modules");
const moduleFileNames = fs.readdirSync(modulesDir).filter((f) => f.endsWith(".ts") && !["types.ts", "registry.ts"].includes(f));
const modules = [];
for (const fileName of moduleFileNames) {
  const mod = await import(pathToFileURL(path.join(modulesDir, fileName)).href);
  const entry = Object.values(mod).find((v) => v && typeof v === "object" && typeof v.slug === "string" && typeof v.files === "function");
  if (entry) modules.push(entry);
}
const foundation = await import(pathToFileURL(path.join(root, "src/lib/engine/foundation-modules.ts")).href);

const knownSlugs = new Set(modules.map((module) => module.slug));
for (const slug of selected) {
  if (!knownSlugs.has(slug)) {
    console.error(`not ok - unknown module slug: ${slug}`);
    process.exit(1);
  }
}

const ctx = {
  projectName: "Compose E2E App",
  roles: ["owner", "admin", "customer", "vendor"],
  roleMatrix: [{ role: "owner", can: ["manage app operations"] }, { role: "customer", can: ["manage own account"] }],
  protectedRoutes: [{ path: "/app", access: ["owner", "admin", "customer"] }, { path: "/admin", access: ["owner", "admin"] }]
};

// Module files (foundation tier + selection), the same rule as the registry's
// modulesFor, then the legacy foundation-modules files the bundle always gets.
const files = [
  ...modules.filter((module) => module.tier === "foundation" || selected.has(module.slug)).flatMap((module) => module.files(ctx)),
  ...foundation.foundationModuleFiles()
];

// The minimal base-generator files the emitted code imports. Everything else the
// modules need, they emit themselves; if a new module starts importing another
// base file, the unresolved-import check below fails loudly rather than hiding it.
const baseFiles = {
  "tsconfig.json": JSON.stringify(
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
        paths: { "@/*": ["./src/*"] }
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules", "tests"]
    },
    null,
    2
  ),
  "next-env.d.ts": '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
  // Verbatim from buildGeneratedFiles in src/lib/engine/app-generator.ts.
  "src/lib/db/client.ts": [
    'import { neon } from "@neondatabase/serverless";',
    "",
    "export function hasDatabase() {",
    '  return Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("USER:PASSWORD@HOST"));',
    "}",
    "",
    "export function getDatabase() {",
    "  if (!hasDatabase()) {",
    '    throw new Error("DATABASE_URL is required before using Neon persistence.");',
    "  }",
    "",
    "  return neon(process.env.DATABASE_URL!);",
    "}",
    ""
  ].join("\n")
};

fs.rmSync(outDir, { recursive: true, force: true });
const emittedPaths = new Set(files.map((file) => file.path));
for (const [filePath, content] of Object.entries(baseFiles)) {
  if (emittedPaths.has(filePath)) continue; // a module-emitted file wins, like the generator
  files.push({ path: filePath, content });
  emittedPaths.add(filePath);
}
for (const file of files) {
  const fullPath = path.join(outDir, file.path);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, file.content, "utf8");
}
console.log(`ok - composed ${files.length} files for selection [${[...selected].join(", ")}] into ${path.relative(root, outDir)}`);

// Selection sanity: every "@/..." import in the composed app must resolve to a
// composed file, so a module can't silently depend on a base file we don't ship.
let unresolved = 0;
for (const file of files) {
  if (!/\.(ts|tsx)$/.test(file.path)) continue;
  for (const match of file.content.matchAll(/from "@\/([^"]+)"/g)) {
    const target = `src/${match[1]}`;
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`];
    if (!candidates.some((candidate) => emittedPaths.has(candidate))) {
      unresolved++;
      console.error(`not ok - ${file.path} imports "@/${match[1]}" which no composed file provides`);
    }
  }
}
if (unresolved) process.exit(1);
console.log("ok - every @/ import in the composed app resolves to a composed file");

const tsc = spawnSync(path.join(root, "node_modules", ".bin", "tsc"), ["-p", outDir], {
  cwd: root,
  encoding: "utf8"
});
if (tsc.status !== 0) {
  console.error(tsc.stdout || tsc.stderr);
  console.error("not ok - composed app failed typecheck");
  process.exit(1);
}
console.log("ok - composed app typechecks clean (tsc against the generated tsconfig)");
console.log("\ne2e compose-selection ok");
