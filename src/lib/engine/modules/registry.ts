// The module registry — the single place the generator asks "which real modules
// can I emit into an app?". Foundation modules are always composed; optional
// modules will be composed when an app selects them (added as they are built out
// to the identity-auth gold standard). This is the seam that turns the module
// catalog from a display-only card list into an installable library.

import type { AppModule, AppModuleContext, GeneratedModuleFile } from "./types";
import { identityAuthModule } from "./identity-auth";
import { directoryCommunityModule } from "./directory-community";

// Registered, build-ready modules (emit real, verified code). As catalog blocks
// are promoted from "pointer" to real modules, they are added here — highest
// demand first. identity-auth + directory-community are live.
const MODULES: AppModule[] = [identityAuthModule, directoryCommunityModule];

export function allModules(): AppModule[] {
  return MODULES;
}

export function foundationModules(): AppModule[] {
  return MODULES.filter((module) => module.tier === "foundation");
}

export function getModule(slug: string): AppModule | undefined {
  return MODULES.find((module) => module.slug === slug);
}

// Slugs of catalog blocks that are actually build-ready today, so the catalog /
// generator can tell "installable now" from "still a sourcing pointer".
export function buildReadyModuleSlugs(): string[] {
  return MODULES.map((module) => module.slug);
}

// ---- composition helpers the generator calls to assemble an app -------------

export function composeModuleFiles(ctx: AppModuleContext): GeneratedModuleFile[] {
  return MODULES.flatMap((module) => module.files(ctx));
}

export function composeModuleEnvLines(): string[] {
  return MODULES.flatMap((module) => module.envLines?.() ?? []);
}

export function composeModuleHomeLinks(): string {
  return MODULES.flatMap((module) => module.homeLinks?.() ?? []).join("\n");
}

export function composeModuleSchemaSql(): string {
  return MODULES.map((module) => module.schemaSql?.() ?? "").filter(Boolean).join("\n");
}

export function composeModuleSeedSql(): string {
  return MODULES.map((module) => module.seedSql?.() ?? "").filter(Boolean).join("\n");
}
