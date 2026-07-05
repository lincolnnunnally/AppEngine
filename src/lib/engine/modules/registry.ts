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
import { relationshipRepairModule } from "./relationship-repair";
import { eventCurationModule } from "./event-curation-service-loop";
import { discipleshipContentModule } from "./discipleship-content";
import { mentorshipCoachingModule } from "./mentorship-coaching";
import { testimonyEngineModule } from "./testimony-engine";
import { needsHelperMatchingModule } from "./needs-helper-matching";
import { careCounselingModule } from "./care-counseling";
import { crmFollowUpModule } from "./crm-follow-up";
import { analyticsHopeModule } from "./analytics-hope-index";
import { eventsSchedulingModule } from "./events-scheduling";
import { locationProximityModule } from "./location-proximity";
import { websiteBuilderModule } from "./website-builder";
import { mutualAidModule } from "./mutual-aid-benevolence";
import { achievementsModule } from "./achievements-gamification";
import { volunteerSafetyModule } from "./volunteer-safety";
import { brandingDesignModule } from "./branding-design";
import { aiAssistModule } from "./ai-assist";
import { ideaCaptureModule } from "./idea-capture-forge";
import { designStudioModule } from "./design-studio";
import { caseManagementModule } from "./case-management";
import { mediatedCommModule } from "./mediated-communication";
import { ratingsReviewsModule } from "./ratings-reviews";
import { brandKitModule } from "./brand-kit-generator";
import { checkinModule } from "./checkin";
import { scriptureSermonModule } from "./scripture-sermon-tools";
import { liveServiceModule } from "./live-service-streaming";
import { growthTrackingModule } from "./growth-tracking";
import { marketplaceOrdersModule } from "./marketplace-orders";
import { proofApprovalModule } from "./proof-approval-artifact";
import { financeAccountingModule } from "./finance-accounting";
import { multiOrgModule } from "./multi-org-association";
import { mediaRecordingModule } from "./media-recording";
import { creatorAnalyticsModule } from "./creator-analytics-coaching";
import { knowledgeBaseModule } from "./knowledge-base";
import { fleetMonitoringModule } from "./fleet-monitoring-agent";
import { supplierAutomationModule } from "./supplier-order-automation";
import { contentSchedulerModule } from "./content-publishing-scheduler";
import { businessFormationModule } from "./business-formation-provisioning";

const MODULES: AppModule[] = [
  identityAuthModule,
  directoryCommunityModule,
  connectionEngineModule,
  purposeOnboardingModule,
  becomingGrowthModule,
  publicInviteModule,
  publicProfileModule,
  adminOpsModule,
  communicationModule,
  relationshipRepairModule,
  eventCurationModule,
  discipleshipContentModule,
  mentorshipCoachingModule,
  testimonyEngineModule,
  needsHelperMatchingModule,
  careCounselingModule,
  crmFollowUpModule,
  analyticsHopeModule,
  eventsSchedulingModule,
  locationProximityModule,
  websiteBuilderModule,
  mutualAidModule,
  achievementsModule,
  volunteerSafetyModule,
  brandingDesignModule,
  aiAssistModule,
  ideaCaptureModule,
  designStudioModule,
  caseManagementModule,
  mediatedCommModule,
  ratingsReviewsModule,
  brandKitModule,
  checkinModule,
  scriptureSermonModule,
  liveServiceModule,
  growthTrackingModule,
  marketplaceOrdersModule,
  proofApprovalModule,
  financeAccountingModule,
  multiOrgModule,
  mediaRecordingModule,
  creatorAnalyticsModule,
  knowledgeBaseModule,
  fleetMonitoringModule,
  supplierAutomationModule,
  contentSchedulerModule,
  businessFormationModule
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
