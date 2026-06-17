import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

export const lifeCoreJourneyStages = [
  "survival",
  "hope",
  "action",
  "discovery",
  "becoming",
  "thriving",
  "multiplication"
] as const;

export type LifeCoreJourneyStage = (typeof lifeCoreJourneyStages)[number];

export const lifeCoreExperienceIds = [
  "united_under_god",
  "spark_of_hope",
  "live_on_mission",
  "best_life",
  "church_connect",
  "we_succeed",
  "child_first"
] as const;

export type LifeCoreExperienceId = (typeof lifeCoreExperienceIds)[number];

export type LifeCorePersonProfile = {
  id: string;
  displayName: string;
  role: "owner" | "participant" | "church_leader" | "volunteer" | "partner";
  currentStage: LifeCoreJourneyStage;
  primaryExperience: LifeCoreExperienceId;
  summary: string;
};

export type LifeCoreOrganization = {
  id: string;
  name: string;
  kind: "mission_network" | "church" | "ministry" | "business" | "family_support" | "community";
  experience: LifeCoreExperienceId;
  purpose: string;
};

export type LifeCoreCommunity = {
  id: string;
  name: string;
  organizationId: string;
  experience: LifeCoreExperienceId;
  stageFocus: LifeCoreJourneyStage[];
  summary: string;
};

export type LifeCoreTestimony = {
  id: string;
  title: string;
  profileId: string;
  experience: LifeCoreExperienceId;
  fromStage: LifeCoreJourneyStage;
  toStage: LifeCoreJourneyStage;
  summary: string;
};

export type LifeCoreOpportunity = {
  id: string;
  title: string;
  experience: LifeCoreExperienceId;
  stage: LifeCoreJourneyStage;
  barrierRemoved: string;
  needAddressed: string;
  nextAction: string;
};

export type LifeCoreActivityFeedItem = {
  id: string;
  occurredAt: string;
  experience: LifeCoreExperienceId;
  stage: LifeCoreJourneyStage;
  title: string;
  summary: string;
  itemType: "testimony" | "opportunity" | "community" | "profile" | "system";
};

export type LifeCoreEcosystemExperience = {
  id: LifeCoreExperienceId;
  name: string;
  category: "mission_unity" | "encouragement" | "service" | "flourishing" | "church_operations" | "business_support" | "family_support";
  purpose: string;
  audience: string[];
  boundaries: string[];
  sampleModules: string[];
};

export type LifeCoreModule = {
  id: string;
  name: string;
  purpose: string;
};

export type LifeCoreOverview = {
  kind: "life_core_overview";
  schemaVersion: 1;
  journeyStages: LifeCoreJourneyStage[];
  experiences: LifeCoreEcosystemExperience[];
  modules: LifeCoreModule[];
  profiles: LifeCorePersonProfile[];
  organizations: LifeCoreOrganization[];
  communities: LifeCoreCommunity[];
  testimonies: LifeCoreTestimony[];
  opportunities: LifeCoreOpportunity[];
  feed: LifeCoreActivityFeedItem[];
  distinctions: {
    unitedUnderGod: string;
    churchConnect: string;
  };
  guardrails: ReturnType<typeof lifeCoreGuardrails>;
};

type LifeCoreStore = {
  schemaVersion: 1;
  overview: LifeCoreOverview;
};

export function lifeCoreGuardrails() {
  return {
    ...durableStateGuardrails(),
    readOnlyFoundationPreview: true,
    localMockOrExistingStorageOnly: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    noProductionDeploy: true,
    preserveExperienceSeparation: true
  };
}

export async function getLifeCoreOverview() {
  const store = await readLifeCoreStore();
  return store.overview;
}

export async function listLifeCoreProfiles() {
  return (await getLifeCoreOverview()).profiles;
}

export async function listLifeCoreCommunities() {
  const overview = await getLifeCoreOverview();
  return {
    organizations: overview.organizations,
    communities: overview.communities
  };
}

export async function listLifeCoreTestimonies() {
  return (await getLifeCoreOverview()).testimonies;
}

export async function listLifeCoreOpportunities() {
  return (await getLifeCoreOverview()).opportunities;
}

export async function listLifeCoreFeedItems() {
  return (await getLifeCoreOverview()).feed;
}

async function readLifeCoreStore() {
  const adapter = getAppEngineStateAdapter();
  return adapter.readJson<LifeCoreStore>({ kind: "life_core" }, {
    schemaVersion: 1,
    overview: createSeedOverview()
  });
}

function createSeedOverview(): LifeCoreOverview {
  const profiles: LifeCorePersonProfile[] = [
    {
      id: "profile_lincoln",
      displayName: "Lincoln",
      role: "owner",
      currentStage: "action",
      primaryExperience: "united_under_god",
      summary: "Stewards the ecosystem so ideas become bounded tools that help people move toward life."
    },
    {
      id: "profile_story_seeker",
      displayName: "Hope seeker",
      role: "participant",
      currentStage: "hope",
      primaryExperience: "spark_of_hope",
      summary: "Needs a safe first step from isolation toward encouragement and a human response."
    },
    {
      id: "profile_church_admin",
      displayName: "Church coordinator",
      role: "church_leader",
      currentStage: "discovery",
      primaryExperience: "church_connect",
      summary: "Needs practical coordination tools for communication, volunteers, events, and office workflows."
    }
  ];

  const organizations: LifeCoreOrganization[] = [
    {
      id: "org_united_under_god",
      name: "United Under God",
      kind: "mission_network",
      experience: "united_under_god",
      purpose: "A mission, unity, and collaboration layer where people discover shared burdens and realize they are not alone."
    },
    {
      id: "org_church_connect",
      name: "ChurchConnect",
      kind: "church",
      experience: "church_connect",
      purpose: "A church operations layer for communications, events, directories, volunteer coordination, and admin workflows."
    },
    {
      id: "org_child_first",
      name: "Child First network",
      kind: "family_support",
      experience: "child_first",
      purpose: "A family stability support path focused on children, parents, and healthier next steps."
    }
  ];

  const communities: LifeCoreCommunity[] = [
    {
      id: "community_shared_burdens",
      name: "Shared Burden Discovery",
      organizationId: "org_united_under_god",
      experience: "united_under_god",
      stageFocus: ["hope", "action", "discovery"],
      summary: "A mission network space where people can name burdens, find others, and move toward collaborative action."
    },
    {
      id: "community_church_ops",
      name: "Church Operations Team",
      organizationId: "org_church_connect",
      experience: "church_connect",
      stageFocus: ["action", "discovery", "becoming"],
      summary: "A practical church coordination space for schedules, volunteers, announcements, and office follow-through."
    },
    {
      id: "community_family_stability",
      name: "Family Stability Circle",
      organizationId: "org_child_first",
      experience: "child_first",
      stageFocus: ["survival", "hope", "action"],
      summary: "A support community for families who need clarity, advocacy, and a next safe action."
    }
  ];

  const testimonies: LifeCoreTestimony[] = [
    {
      id: "testimony_not_alone",
      title: "I found out I was not alone",
      profileId: "profile_story_seeker",
      experience: "united_under_god",
      fromStage: "survival",
      toStage: "hope",
      summary: "A person named a burden and discovered others were carrying the same concern with them."
    },
    {
      id: "testimony_first_story",
      title: "One story became a next step",
      profileId: "profile_story_seeker",
      experience: "spark_of_hope",
      fromStage: "hope",
      toStage: "action",
      summary: "A short story intake created a clear encouragement response instead of another open-ended conversation."
    }
  ];

  const opportunities: LifeCoreOpportunity[] = [
    {
      id: "opportunity_shared_burden_map",
      title: "Map shared burdens across the mission network",
      experience: "united_under_god",
      stage: "discovery",
      barrierRemoved: "People carrying the same burden do not know each other exists.",
      needAddressed: "A safe way to discover alignment before creating a project or ministry workflow.",
      nextAction: "Collect a problem-first opportunity and route it through owner review."
    },
    {
      id: "opportunity_church_volunteers",
      title: "Coordinate Sunday volunteer coverage",
      experience: "church_connect",
      stage: "action",
      barrierRemoved: "Church staff rely on scattered messages and memory for volunteer coverage.",
      needAddressed: "Clear church operations coordination with a visible next owner.",
      nextAction: "Keep the workflow inside ChurchConnect, not the United Under God mission layer."
    },
    {
      id: "opportunity_story_response",
      title: "Prepare a safe encouragement response",
      experience: "spark_of_hope",
      stage: "hope",
      barrierRemoved: "A hopeful story can be received without forcing a full account or public post.",
      needAddressed: "A gentle first response that honors privacy and preserves agency.",
      nextAction: "Review the story and choose an encouragement follow-up."
    }
  ];

  const feed: LifeCoreActivityFeedItem[] = [
    {
      id: "feed_foundation_created",
      occurredAt: "2026-06-17T00:00:00.000Z",
      experience: "united_under_god",
      stage: "action",
      itemType: "system",
      title: "Life Core foundation preview created",
      summary: "The shared contracts now expose journey stages, experience boundaries, sample opportunities, and a unified feed."
    },
    {
      id: "feed_shared_burden",
      occurredAt: "2026-06-17T00:10:00.000Z",
      experience: "united_under_god",
      stage: "discovery",
      itemType: "opportunity",
      title: "Shared burden discovery is ready for owner review",
      summary: "United Under God stays focused on unity, collaboration, encouragement, and shared problem discovery."
    },
    {
      id: "feed_church_ops",
      occurredAt: "2026-06-17T00:20:00.000Z",
      experience: "church_connect",
      stage: "action",
      itemType: "community",
      title: "Church operations sample added",
      summary: "ChurchConnect stays focused on church communications, events, directories, volunteers, and admin operations."
    }
  ];

  return {
    kind: "life_core_overview",
    schemaVersion: 1,
    journeyStages: [...lifeCoreJourneyStages],
    experiences: createExperiences(),
    modules: [
      {
        id: "journey_stage",
        name: "Journey Stage",
        purpose: "Name where a person, opportunity, testimony, or community is moving on the Survival to Multiplication path."
      },
      {
        id: "ecosystem_experience",
        name: "Ecosystem Experience",
        purpose: "Keep each app or experience connected to the shared philosophy without sharing another app's purpose."
      },
      {
        id: "unified_feed",
        name: "Unified Activity Feed",
        purpose: "Show safe, cross-experience activity without blending private data, workflows, or app ownership."
      },
      {
        id: "testimony_opportunity",
        name: "Testimony and Opportunity",
        purpose: "Connect visible fruit, barriers, needs, and next useful actions."
      }
    ],
    profiles,
    organizations,
    communities,
    testimonies,
    opportunities,
    feed,
    distinctions: {
      unitedUnderGod: "United Under God is the mission, unity, encouragement, collaboration, shared-burden, and problem-discovery layer.",
      churchConnect: "ChurchConnect is the church operations layer for communications, events, directories, volunteer coordination, and office/admin workflows."
    },
    guardrails: lifeCoreGuardrails()
  };
}

function createExperiences(): LifeCoreEcosystemExperience[] {
  return [
    {
      id: "united_under_god",
      name: "United Under God",
      category: "mission_unity",
      purpose: "Mission network, body-of-Christ collaboration, encouragement, shared burden discovery, and helping people realize they are not alone.",
      audience: ["mission leaders", "churches", "builders", "people carrying shared burdens"],
      boundaries: ["Does not become church office software.", "Does not absorb ChurchConnect events, directories, volunteer scheduling, or admin operations."],
      sampleModules: ["shared burden discovery", "mission network map", "encouragement prompts"]
    },
    {
      id: "spark_of_hope",
      name: "Spark of Hope",
      category: "encouragement",
      purpose: "Help people move from isolation or discouragement toward hope through story, encouragement, and a clear next step.",
      audience: ["people seeking hope", "encouragement reviewers"],
      boundaries: ["Does not become the full ecosystem directory.", "Does not replace pastoral or emergency care."],
      sampleModules: ["story intake", "encouragement response", "review queue"]
    },
    {
      id: "live_on_mission",
      name: "Live On Mission",
      category: "service",
      purpose: "Turn hope into practical acts of service and neighbor-love.",
      audience: ["volunteers", "mission participants", "local leaders"],
      boundaries: ["Does not become a generic social feed.", "Does not replace church operations tooling."],
      sampleModules: ["service actions", "mission prompts", "local opportunities"]
    },
    {
      id: "best_life",
      name: "Best Life",
      category: "flourishing",
      purpose: "Help people discover, practice, and sustain patterns of flourishing.",
      audience: ["individuals", "coaches", "groups"],
      boundaries: ["Does not become passive content consumption.", "Does not claim another app's transformation path."],
      sampleModules: ["growth practices", "reflection", "progress markers"]
    },
    {
      id: "church_connect",
      name: "ChurchConnect",
      category: "church_operations",
      purpose: "Church communications, events, directories, volunteer coordination, and church office/admin operations.",
      audience: ["church staff", "ministry leaders", "volunteers", "members"],
      boundaries: ["Does not become the United Under God mission network.", "Does not own shared burden discovery outside church operations."],
      sampleModules: ["events", "directories", "volunteer scheduling", "announcements"]
    },
    {
      id: "we_succeed",
      name: "We Succeed",
      category: "business_support",
      purpose: "Support practical stewardship, business capability, and people helping each other succeed.",
      audience: ["business owners", "teams", "operators"],
      boundaries: ["Does not become ministry care workflow.", "Does not import church member data."],
      sampleModules: ["business support", "operator workflow", "accountability"]
    },
    {
      id: "child_first",
      name: "Child First",
      category: "family_support",
      purpose: "Help families and advocates move toward child-centered stability, clarity, and healthier action.",
      audience: ["parents", "advocates", "families"],
      boundaries: ["Does not become legal advice.", "Does not share sensitive family data across apps without explicit integration."],
      sampleModules: ["family stability intake", "support planning", "resource path"]
    }
  ];
}
