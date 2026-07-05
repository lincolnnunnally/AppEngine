// The module registry — the library of build-ready blocks the generator can
// compose into an app. Foundation-tier modules go into every app; optional-tier
// modules go in ONLY when that app selects them (see modulesFor). Not every
// module goes into every app — apps pull the subset they need and combine them.
// As catalog blocks are completed from their real source, they are registered here.

import type { AppModule, AppModuleContext, GeneratedModuleFile } from "./types";
import { identityAuthModule } from "./identity-auth";
import { directoryCommunityModule } from "./directory-community";
import { connectionEngineModule } from "./connection-engine";
import { purposeOnboardingModule } from "./purpose-onboarding";
import { becomingGrowthModule } from "./becoming-growth-dashboard";
import { publicInviteModule } from "./public-invite-loop";
import { publicProfileModule } from "./public-profile-og-sharing";
import { adminOpsModule } from "./admin-ops-moderation";
import { communicationModule } from "./communication";

const MODULES: AppModule[] = [
  identityAuthModule,
  directoryCommunityModule,
  connectionEngineModule,
  purposeOnboardingModule,
  becomingGrowthModule,
  publicInviteModule,
  publicProfileModule,
  adminOpsModule,
  communicationModule
];

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

// ---- composition (selective, per app) ---------------------------------------

// Which modules an app receives: foundation always, optional only when selected.
// A `selected` of undefined means "everything" — used by verification/tooling
// that composes the whole library; the generator always passes an explicit set,
// so a real app only gets its foundation + the optional blocks it chose.
function modulesFor(selected?: Set<string>): AppModule[] {
  if (!selected) return MODULES;
  return MODULES.filter((module) => module.tier === "foundation" || selected.has(module.slug));
}

export function composeModuleFiles(ctx: AppModuleContext, selected?: Set<string>): GeneratedModuleFile[] {
  return modulesFor(selected).flatMap((module) => module.files(ctx));
}

export function composeModuleEnvLines(selected?: Set<string>): string[] {
  return modulesFor(selected).flatMap((module) => module.envLines?.() ?? []);
}

export function composeModuleHomeLinks(selected?: Set<string>): string {
  return modulesFor(selected).flatMap((module) => module.homeLinks?.() ?? []).join("\n");
}

export function composeModuleSchemaSql(selected?: Set<string>): string {
  return modulesFor(selected).map((module) => module.schemaSql?.() ?? "").filter(Boolean).join("\n");
}

export function composeModuleSeedSql(selected?: Set<string>): string {
  return modulesFor(selected).map((module) => module.seedSql?.() ?? "").filter(Boolean).join("\n");
}
