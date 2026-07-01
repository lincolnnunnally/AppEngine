# Design Intent Engine

AppEngine must capture design intent before generated UI is created, polished, reviewed, or released.

Design intent is the bridge between the app's purpose and the visual/interaction choices that make the app feel appropriate to its audience. It prevents AppEngine from producing generic, same-feeling apps that technically work but do not build trust, fit the user, or express the app's purpose.

This is a foundation/design-intent standard only. It does not authorize redesigns of existing UI, production deployment, paid resources, migrations, secrets, environment changes, repository visibility changes, automatic Codex build work, or execution labels.

## Wired into the generator (2026-07-01)

The named style profiles are no longer planning-only — they are REAL, selectable themes that drive every generated app's stylesheet (`src/lib/engine/themes.ts`, consumed by `app-generator.ts`). Six themes ship: `warm-approachable` (default), `professional-clean`, `premium-modern`, `playful-friendly`, `ministry-community`, `operations-dashboard`. In the build flow a person picks one from a visual "choose a look" gallery; if they skip it, `pickThemeForIdea` auto-matches a fitting theme from their idea, so no app renders in a generic default by accident. Each theme sets palette, typography, corner style, and light/dark mode. Every generated app is now mobile-first and ships the `<meta viewport>` (via Next `viewport` export) with `themeColor` + `colorScheme` — closing the prior gap where generated apps rendered zoomed-out on phones. Custom brand color / logo per app is a future extension on top of these presets.

## Purpose

The Design Intent Engine answers:

- Who is this app or workflow for?
- How sophisticated is the target user?
- What should the experience feel like?
- What kind of trust does the user need before acting?
- What accessibility and mobile needs must shape the UI?
- What visual preferences, references, and avoidances should guide the design?
- Which style profile best fits this app?
- What should the designer, builder, reviewer, and release gate preserve?

## Required Capture Fields

Every design intent profile must capture:

- `targetAudience`: the people using or reviewing the experience.
- `userSophisticationLevel`: `beginner`, `mixed`, `advanced`, or `operator`.
- `desiredEmotionalExperience`: the feeling the user should have while using the app.
- `brandPersonality`: words that define how the app should show up.
- `trustNeeds`: what must be visible, clear, or proven for the user to trust the experience.
- `accessibilityNeeds`: readability, contrast, keyboard, screen reader, motion, touch target, or language needs.
- `visualStylePreference`: selected style profile.
- `examplesOrReferences`: optional examples, sites, screenshots, brands, or notes that clarify taste.
- `thingsToAvoid`: visual, copy, interaction, or emotional directions that should not appear.
- `outputGuidance`: practical guidance for colors, typography, spacing, cards, forms, dashboards, navigation, buttons, empty states, and mobile layout.

## Default Design Profile For AppEngine

AppEngine itself should default to:

- warm
- approachable
- clean
- hopeful
- practical
- trustworthy
- not cold
- not generic
- not over-complicated

AppEngine UI should feel like a calm control room for real work. It should be usable on a phone, easy to scan, honest about state, and clear about the next safe action.

## Style Profiles

### `warm_approachable`

Use for hopeful, relational, care-oriented, story-oriented, or confidence-building apps.

Guidance:

- Colors: warm neutrals with grounded green, teal, blue, or gentle accent colors.
- Typography: readable, friendly, calm, not childish.
- Spacing: open enough to feel breathable, dense enough to stay useful.
- Cards: simple, clear, lightly framed.
- Forms: supportive prompts, plain-language labels, reassuring confirmation states.
- Empty states: encouraging and specific about the first next step.
- Mobile: primary action visible, no cramped inputs, touch targets easy to hit.

### `professional_clean`

Use for service businesses, client portals, operations tools with external users, and credibility-focused workflows.

Guidance:

- Colors: restrained neutrals with one or two clear accents.
- Typography: crisp, readable, confident.
- Spacing: organized and predictable.
- Cards: compact and information-first.
- Forms: clear validation, visible progress, no decorative clutter.
- Dashboards: scan-friendly hierarchy with plain status language.
- Mobile: core tasks remain available without desktop assumptions.

### `premium_modern`

Use for higher-trust, high-value, investor-facing, boutique, or polished product experiences.

Guidance:

- Colors: refined contrast, careful accent usage, no loud gradients.
- Typography: confident headings with highly readable body copy.
- Spacing: generous but not wasteful.
- Cards: subtle depth and refined edges.
- Buttons: strong primary action with quiet secondary actions.
- Empty states: polished, purposeful, and conversion-aware.
- Mobile: preserves brand quality without reducing clarity.

### `playful_friendly`

Use for lightweight learning, creativity, family, youth, or low-pressure experiences.

Guidance:

- Colors: cheerful but balanced.
- Typography: friendly and legible.
- Spacing: comfortable and forgiving.
- Forms: short, encouraging, and low-friction.
- Navigation: simple labels, obvious progress.
- Empty states: warm and motivating.
- Mobile: thumb-friendly and not visually noisy.

### `ministry_community`

Use for church, ministry, care, service, belonging, encouragement, discipleship, or community workflows.

Guidance:

- Colors: hopeful, human, grounded, not overly institutional.
- Typography: clear and sincere.
- Copy: respectful, gentle, never manipulative.
- Trust: privacy, care boundaries, and human follow-up should be visible when relevant.
- Forms: emotionally safe and plain-spoken.
- Empty states: orient people toward connection and next steps.
- Mobile: optimized for quick, real-life use by volunteers, leaders, and people receiving care.

### `operations_dashboard`

Use for admin consoles, internal tools, logistics, monitoring, finance/status, provider/cost, and repeat operator workflows.

Guidance:

- Colors: quiet neutrals with status colors used consistently.
- Typography: compact, readable, and scan-first.
- Spacing: dense but not cramped.
- Cards: for repeated items, metrics, summaries, and alerts only.
- Dashboards: prioritize state, blockers, next action, owner, and evidence links.
- Forms: efficient, clear, and resilient.
- Mobile: key status and approval actions remain usable, even if deep analysis is desktop-first.

## Output Guidance Categories

Every profile should guide:

- Colors: palette direction, status color use, contrast needs, and colors to avoid.
- Typography: tone, scale, readability, and whether the app needs compact or spacious text.
- Spacing: density, rhythm, and mobile breathing room.
- Cards: when cards are appropriate and when sections should remain unframed.
- Forms: label language, validation tone, consent/trust requirements, and field grouping.
- Dashboards: state hierarchy, scan patterns, metrics, blockers, and next action visibility.
- Navigation: information architecture, mobile navigation, labels, and route clarity.
- Buttons: primary action clarity, destructive action restraint, secondary action treatment.
- Empty states: what a user should understand or do next when there is no data.
- Mobile layout: breakpoint expectations, touch targets, text wrapping, and Safari/mobile behavior.

## Machine-Readable Artifact Contract

Agents should produce a `design_intent_profile` artifact:

```json
{
  "kind": "design_intent_profile",
  "schemaVersion": 1,
  "app": {
    "name": "AppEngine",
    "slug": "appengine",
    "context": "owner operating system for autonomous app building"
  },
  "targetAudience": ["Lincoln", "future app owners", "reviewers"],
  "userSophisticationLevel": "mixed",
  "desiredEmotionalExperience": ["warm", "clear", "hopeful", "capable"],
  "brandPersonality": ["approachable", "practical", "trustworthy"],
  "trustNeeds": ["clear state", "visible guardrails", "honest blockers", "next safe action"],
  "accessibilityNeeds": ["mobile-first", "readable contrast", "large touch targets", "plain language"],
  "visualStylePreference": "warm_approachable",
  "examplesOrReferences": [],
  "thingsToAvoid": ["cold", "generic", "over-complicated", "decorative clutter"],
  "outputGuidance": {
    "colors": "Warm neutrals with grounded teal, blue, green, or amber status accents.",
    "typography": "Readable interface type with clear hierarchy and no oversized dashboard headings.",
    "spacing": "Breathable mobile-first spacing with compact dashboard density where needed.",
    "cards": "Use cards for repeated items and framed tools; avoid nesting cards.",
    "forms": "Plain-English labels, supportive validation, and visible safety notes.",
    "dashboards": "Show state, blockers, next safe action, evidence, owner review URL, and version clearly.",
    "navigation": "Short route labels and obvious owner paths.",
    "buttons": "One clear primary action per section with restrained secondary actions.",
    "emptyStates": "Say what is missing and what the next safe action is.",
    "mobileLayout": "No horizontal overflow, touch-friendly controls, readable copy, Safari-safe forms."
  },
  "ownerReadableSummary": "AppEngine should feel warm, approachable, clean, hopeful, practical, and trustworthy without becoming generic or over-complicated.",
  "guardrails": {
    "foundationOnly": true,
    "noUiRedesign": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noAutomaticCodexBuild": true
  }
}
```

## Required Fields

Every `design_intent_profile` artifact must include:

- `kind`
- `schemaVersion`
- `app.name`
- `app.slug`
- `targetAudience`
- `userSophisticationLevel`
- `desiredEmotionalExperience`
- `brandPersonality`
- `trustNeeds`
- `accessibilityNeeds`
- `visualStylePreference`
- `thingsToAvoid`
- every `outputGuidance` category
- `ownerReadableSummary`
- all guardrails

## Workflow Placement

Design intent should be created or confirmed:

1. After problem/vision intake and before UI design.
2. Before App Build Packet or vNext Packet phases that include UI.
3. Before Designer creates page sections, flows, copy, or layout direction.
4. Before Builder creates generated app UI.
5. Before Design Review and Customer Perspective Review judge whether the app feels right.

`design_intent_profile` does not replace `design_review`. It gives Designer, Builder, Customer Perspective, Code Reviewer, and Release Gate the intended target so they can avoid generic or mismatched UI.

## Failure Conditions

Agents must fail honestly or request clarification when:

- target audience is missing
- emotional experience is missing
- trust needs are missing
- accessibility needs are missing
- visual style preference is unknown
- things to avoid are missing
- output guidance is too vague to guide UI choices
- an app tries to borrow another app's emotional promise without an approved integration
- design intent conflicts with the app charter, audience, or purpose

## Success Criteria

The Design Intent Engine is working when:

1. AppEngine can produce a valid `design_intent_profile`.
2. Future app UI work begins with audience, feeling, trust, accessibility, and visual preference.
3. AppEngine has a default profile that is warm, approachable, clean, hopeful, practical, and trustworthy.
4. Designer, Builder, Customer Perspective, Code Reviewer, and Release Gate can use the profile as evidence.
5. Missing design-intent fields fail honestly before UI generation.
6. The profile remains foundation/design-intent only and does not trigger redesign, deployment, paid resources, migrations, env changes, or automatic build work.
