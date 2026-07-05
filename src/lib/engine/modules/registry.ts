// The module registry — the single place the generator asks "which real modules
// can I emit into an app?". Foundation modules are always composed; optional
// modules will be composed when an app selects them (added as they are built out
// to the identity-auth gold standard). This is the seam that turns the module
// catalog from a display-only card list into an installable library.

import type { AppModule } from "./types";
import { identityAuthModule } from "./identity-auth";

// Registered, build-ready modules (emit real, verified code). As catalog blocks
// are promoted from "pointer" to real modules, they are added here.
const MODULES: AppModule[] = [identityAuthModule];

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
