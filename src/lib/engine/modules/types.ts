// The AppEngine module contract — how a catalog capability becomes real, emitted
// code inside a generated app. This is the machinery that turns the module
// catalog from a sourcing map into an installable library: a module contributes
// files, schema, env, seed data, and nav, and the generator composes the ones an
// app selects. The five foundation modules (foundation-modules.ts) already follow
// this shape informally; this type makes it explicit so every future module —
// starting with identity-auth — is built to one standard:
//
//   functional   — real code that runs on the app owner's own DB/keys
//   isolated     — its own tables, a feature flag, no provider names shown to users
//   usable       — real empty/loading/error states, plain copy, accessible
//   composable   — emitted by the generator, not just listed as a card
//   verified     — covered by a smoke test

export type GeneratedModuleFile = { path: string; content: string };

// The per-build context a module may read to tailor its emitted files. Kept small
// and stable so modules stay decoupled from the generator's internals.
export type AppModuleContext = {
  projectName: string;
  roles: string[];
  roleMatrix: Array<{ role: string; can: string[] }>;
  protectedRoutes: Array<{ path: string; access: string[] }>;
};

export type ModuleNavLink = { href: string; label: string };

export type AppModule = {
  slug: string;
  name: string;
  // "foundation" modules ship in every app; "optional" ones only when selected.
  tier: "foundation" | "optional";
  // Env flag that switches an optional module off (e.g. "FEATURE_TESTIMONY").
  // Foundation modules leave this undefined — they are always on.
  featureFlagEnv?: string;
  // The real code the module emits into the generated app.
  files: (ctx: AppModuleContext) => GeneratedModuleFile[];
  // Optional contributions, composed alongside the base app.
  schemaSql?: () => string;
  seedSql?: () => string;
  envLines?: () => string[];
  homeLinks?: () => string[];
  navLinks?: () => ModuleNavLink[];
  // Env keys the module needs before it is fully live (for readiness reports).
  requiredEnv?: string[];
};
