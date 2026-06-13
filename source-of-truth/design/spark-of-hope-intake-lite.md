# UI Design Brief: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for UI design planning only.
- Source issue: `#52`.
- Trigger label: manual designer request.
- Agent mode: `designer`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Architecture plan: `source-of-truth/architecture/spark-of-hope-intake-lite.md`.
- Provider/cost review: `source-of-truth/provider-cost/spark-of-hope-intake-lite.md`.
- Data model plan: `source-of-truth/data-model/spark-of-hope-intake-lite.md`.
- Identity/auth plan: `source-of-truth/identity-auth/spark-of-hope-intake-lite.md`.
- Tool classification: Direct Transformation Tool.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Phase boundary: UI design artifact only. No UI code, generated app routes, provider resources, preview deployment, production deployment, production secrets, paid resources, real user data, or generated app merge occurred.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/prompts/designer.md`
- `agents/context/output-contracts.md`
- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/provider-cost/spark-of-hope-intake-lite.md`
- `source-of-truth/data-model/spark-of-hope-intake-lite.md`
- `source-of-truth/identity-auth/spark-of-hope-intake-lite.md`
- `source-of-truth/design-quality-gate.md`
- `source-of-truth/ux-review-standard.md`
- `source-of-truth/compatibility-standard.md`

## Ecosystem Design Gates

| Gate | Answer |
| --- | --- |
| What barrier does this remove? | It removes the design barrier of a sensitive story workflow feeling like a generic form, a public feed, or an unsafe admin queue. |
| What need does this address? | Story sharers need a calm, trusted path to share one hopeful story; reviewers, admins, and volunteers need clear screens that protect privacy while helping them respond. |
| How does this help someone move toward life? | The experience helps a person move from holding a story alone toward being heard, stewarded, and encouraged without unnecessary exposure. |
| How does this help someone become a source of life for others? | The review and response screens help approved people prepare encouragement carefully, with enough context to serve and enough boundaries to protect the story sharer. |

## Experience Intent

Spark of Hope Intake Lite should feel calm, careful, and practical. It is emotionally present because it handles personal stories, but it must not become dramatic, performative, viral, or content-driven.

The first screen should immediately communicate the specific purpose: share one hopeful story so a church or ministry team can review it responsibly and prepare encouragement. The app should avoid borrowed promises from the full Spark of Hope product, counseling tools, social networks, donor systems, or church CRMs.

The visual posture should be warm and trustworthy with high contrast, readable text, restrained color, generous spacing, and clear boundaries around privacy-sensitive actions. Admin and Super Admin surfaces should be compact, operational, and scan-friendly.

## Experience Map

| Journey | Person | Need | Primary movement | Screens |
| --- | --- | --- | --- | --- |
| Public story sharing | Story sharer | Share one hopeful story without feeling exposed. | From alone with a story to heard and safely stewarded. | Landing, share form, privacy, thank-you. |
| Optional account status | Story sharer with account | See whether the story was received and know what can happen next. | From uncertainty to clear status and agency. | Account status, story status detail, export/deletion request if later built. |
| Review workflow | Reviewer or admin | Review stories responsibly and decide the next care step. | From scattered intake to private, accountable review. | Review queue, review detail, status timeline. |
| Encouragement workflow | Volunteer or reviewer | Prepare encouragement from assigned work only. | From vague intention to concrete encouragement. | Response queue, response detail, prepared success. |
| Admin stewardship | Owner or admin | Manage settings, users, roles, retention, incidents, and workflow health. | From hidden operational risk to accountable stewardship. | Admin overview, users, settings, incidents, follow-ups. |
| Super Admin oversight | AppEngine owner/admin | See pilot status without entering private story content. | From scattered app state to one operational status surface. | Super Admin app status, health, logs, deployment, billing/status. |

## Navigation Model

Public navigation should stay minimal:

- `Share a story`
- `Privacy`
- Optional `Sign in` only when account status is enabled.

Authenticated customer navigation should stay scoped:

- `My story`
- `Account`
- `Privacy`

Admin navigation should use a compact app-local sidebar or tab row:

- `Overview`
- `Stories`
- `Responses`
- `Users`
- `Settings`
- `Incidents`
- `Follow-ups`

Super Admin navigation should remain operational:

- `Status`
- `Health`
- `Logs`
- `Deployment`
- `Users`
- `Actions`

Mobile navigation should use a top bar with the app name and a menu button. Primary action buttons must stay visible at the end of each main task section and should not require horizontal scrolling.

## Screen Inventory

| Screen | Route | Audience | Primary action | Secondary actions | Notes |
| --- | --- | --- | --- | --- | --- |
| Public landing | `/spark-of-hope-intake-lite` | Story sharer | `Share a story` | `Read privacy note` | First viewport names the app and purpose. Avoid marketing-heavy hero treatment. |
| Story share form | `/spark-of-hope-intake-lite/share` | Story sharer | `Submit story` | `Save nothing and leave`, `Read privacy note` | Mobile-first single-column form with consent close to submit. |
| Privacy explanation | `/spark-of-hope-intake-lite/privacy` | Story sharer | `Back to story` | none | Plain-language privacy, consent, review, and contact expectations. |
| Thank-you | `/spark-of-hope-intake-lite/share/thanks` | Story sharer | `Save reference` or `Done` | `Create account to track status` only if enabled | Must not expose story body or internal ids. |
| Optional account status | `/app/spark-of-hope-intake-lite` | Customer | `View story status` | `Account`, `Privacy` | Only show own submissions. Empty state explains no submitted stories. |
| Optional story status detail | `/app/spark-of-hope-intake-lite/stories/:storyId` | Customer | `Review status` or `Request update` if later supported | `Request export`, `Request deletion` if later supported | Keep status simple and non-alarming. |
| Admin overview | `/admin/apps/spark-of-hope-intake-lite` | Owner/admin | `Review new stories` | `View responses`, `Manage users`, `View status` | Compact summary: new, in review, response needed, blocked. |
| Review queue | `/admin/apps/spark-of-hope-intake-lite/stories` | Owner/admin/reviewer | `Open next story` | Filter by status, assignment, date | Cards or rows should show safe metadata only. |
| Review detail | `/admin/apps/spark-of-hope-intake-lite/stories/:storyId` | Owner/admin/assigned reviewer | `Mark ready for response` | `Needs follow-up`, `Close`, `Delete/redact request`, `Assign reviewer` | Story body and contact details are visually separated. |
| Response queue | `/admin/apps/spark-of-hope-intake-lite/responses` | Owner/admin/reviewer/volunteer | `Open assigned response` | Filter by assigned, status | Volunteers see assigned work only. |
| Response detail | `/admin/apps/spark-of-hope-intake-lite/responses/:responseId` | Assigned reviewer/volunteer/admin | `Mark prepared` | `Save draft`, `Needs review` | Show minimum necessary story context; hide contact by default. |
| Users | `/admin/apps/spark-of-hope-intake-lite/users` | Owner/admin | `Invite user` | `Change role`, `Suspend access` | Role descriptions must be clear and app-scoped. |
| Settings | `/admin/apps/spark-of-hope-intake-lite/settings` | Owner/admin | `Save settings` | `Cancel changes` | Retention, privacy copy version, assignment rules, response workflow. |
| Incidents | `/admin/apps/spark-of-hope-intake-lite/incidents` | Owner/admin | `Create incident` | `View status` | Private-safe operational incident handoff. |
| Follow-ups | `/admin/apps/spark-of-hope-intake-lite/follow-ups` | Owner/admin | `Create follow-up` | `Copy issue details` | Issue-ready task creation, no story content in body. |
| Super Admin status | `/admin/apps/spark-of-hope-intake-lite` plus engine status APIs | AppEngine owner/admin | `Open app admin` | `View health`, `View logs`, `Create incident`, `Create follow-up` | Operational metadata only. Billing/status says `not_applicable` for MVP. |

## Content Hierarchy

Public intake hierarchy:

1. App name and specific purpose.
2. Privacy and trust statement.
3. Story fields.
4. Contact and consent choices.
5. Submit action.
6. What happens next.

Admin/review hierarchy:

1. Queue status and next work.
2. Assignment and review status.
3. Story content.
4. Contact details, visually separated and permission-gated.
5. Decision controls.
6. Audit/status timeline.

Response hierarchy:

1. Assignment and due/status context.
2. Minimum necessary story summary.
3. Response draft field.
4. Review/prepared controls.
5. Private-safe timeline.

Super Admin hierarchy:

1. Lifecycle status.
2. Release gate status.
3. Health and dependency status.
4. Logs/deployment links.
5. User/admin status.
6. Actions.

## Controls

Use familiar controls and keep touch targets at least 44 by 44 CSS pixels:

- Primary buttons for final actions: `Share story`, `Submit story`, `Open next story`, `Mark ready for response`, `Mark prepared`, `Save settings`.
- Secondary buttons for reversible or lower-risk actions: `Save draft`, `Cancel`, `Back`, `Read privacy note`.
- Destructive or sensitive actions require confirmation: `Delete`, `Redact`, `Suspend access`, `Close without response`.
- Segmented controls or tabs for queue filters: `New`, `In review`, `Needs response`, `Closed`.
- Checkboxes for consent choices with full labels, not icon-only consent.
- Menus for role changes and assignment.
- Text areas with clear character guidance for story body, review notes, and response body.
- Status badges for `New`, `In review`, `Needs follow-up`, `Ready for response`, `Prepared`, `Closed`, `Deleted`.

## Copy Guidance

Use plain, human language. Avoid technical labels on public screens and avoid overly emotional promises.

Recommended public copy direction:

- Landing support text: "Share one hopeful story. A trusted team can review it privately and prepare encouragement with care."
- Privacy note: "Your story is private by default. It is reviewed only by approved people for this pilot."
- Consent label: "I understand this story may be reviewed by an approved team for encouragement."
- Contact choice: "It is okay to contact me about this story."
- Thank-you: "Your story was received. Keep this reference if you need to ask about it later."

Recommended admin copy direction:

- Empty review queue: "No stories are waiting for review."
- Response queue empty: "No encouragement responses are assigned right now."
- Contact boundary label: "Contact details are shown only when needed for review or follow-up."
- Volunteer context label: "This is the story context needed for this response. Contact details are hidden."

Avoid:

- "Go viral", "publish", "share with the world", or social-feed language.
- Counseling, crisis, emergency, medical, or legal claims.
- Full Spark of Hope platform language unless a later packet approves expansion.

## State Checklist

| Surface | Empty state | Loading state | Error state | Success state |
| --- | --- | --- | --- | --- |
| Public landing | Not applicable | Lightweight page skeleton or no spinner needed | Public-safe "This page could not load" with retry | User reaches share form. |
| Story share form | Blank form with calm prompt | Submit button shows pending state and prevents duplicate taps | Inline validation; failed submit says story was not saved and offers retry | Redirect to thank-you. |
| Thank-you | Not applicable | Loading if reference lookup is used | Reference unavailable, but do not reveal private data | Story received, next steps clear. |
| Optional account status | No stories submitted | Status list skeleton | Auth or fetch failure with sign-in/retry path | Story status shown for owner only. |
| Review queue | No stories waiting | Row/card skeletons | Queue could not load, retry and report issue | Reviewer opens next story. |
| Review detail | Missing or unauthorized story state | Story detail skeleton | Not found, unauthorized, or save failed | Status updated and timeline records event. |
| Response queue | No assigned responses | Queue skeleton | Queue could not load or assignment revoked | Volunteer opens assigned task. |
| Response detail | No draft started | Draft save pending state | Save failed, assignment revoked, unauthorized | Draft saved or marked prepared. |
| Users | No invited users beyond owner/admin | User table skeleton | Invite or role update failed | User invited or role changed. |
| Settings | Defaults visible | Save pending state | Validation or save failure with field-level help | Settings saved. |
| Incidents | No incidents | Incident list skeleton | Incident creation failed | Incident created with safe summary. |
| Follow-ups | No follow-ups | Follow-up list skeleton | Follow-up creation failed | Follow-up task prepared or created by allowed workflow. |
| Super Admin status | Status unknown | Compact status skeleton | Health/log/status unavailable without private details | Status visible with next action. |

## Onboarding

Story sharer onboarding happens inside the first screen and share form:

- What this is: one hopeful story intake.
- Who may review it: approved team for this pilot.
- What happens next: review and possible encouragement preparation.
- What this is not: emergency, counseling, public publishing, or a full social platform.

Admin onboarding should use an app overview setup checklist:

- Confirm owner/admin access.
- Confirm privacy copy version.
- Confirm retention setting.
- Invite reviewer or volunteer if needed.
- Review health/status before preview.

Volunteer onboarding should appear before the first assigned response:

- Prepare encouragement only for assigned work.
- Use the minimum story context shown.
- Do not copy story/contact details into unrelated systems.
- Mark prepared when the response is ready for admin review or manual delivery.

## Mobile-First Layout

- Use a single-column public form on mobile.
- Keep form labels above inputs, not only as placeholders.
- Avoid sticky footers that cover form controls in iPhone Safari.
- Use full-width primary buttons on mobile, with enough vertical spacing from secondary actions.
- Keep admin tables responsive by switching to scan-friendly row cards below tablet width.
- Keep admin filters in a horizontal scroll-safe chip group or stacked controls with no clipped labels.
- Use readable body text, preferably 16px or larger for form inputs to avoid mobile zoom behavior.
- Do not rely on hover interactions for essential controls.

## Accessibility And Trust

- Maintain WCAG-friendly contrast for text, inputs, focus rings, and status badges.
- Preserve keyboard navigation order from top to bottom and left to right.
- Give every form field a visible label, helper text where needed, and field-level errors.
- Use clear focus states for keyboard and screen-reader users.
- Make status color supplemental, with text labels always present.
- Confirm destructive actions with plain-language consequences.
- Do not show private story details in toasts, URLs, logs, health checks, issue bodies, or Super Admin summaries.

## Compatibility Notes

Required test targets remain:

- iPhone Safari.
- iPad Safari.
- Desktop Safari.
- Chrome mobile.
- Chrome desktop.
- Edge desktop.
- Firefox desktop.
- Viewports: `360x640`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1280x720`, `1440x900`.

Compatibility risks that need follow-up:

- Public story form validation and multi-line text areas on iPhone Safari.
- Auth redirects for optional account status and admin screens on Safari and mobile browsers.
- Touch-target density in admin queue filters and row actions.
- Admin row-card layout at tablet sizes.
- Preventing duplicate form submission on slow mobile connections.

No uploads, payments, automated email, AI generation, or browser-specific media APIs are included in this MVP design. If added later, compatibility and provider/cost review must reopen.

## Release Readiness

Designer review status: completed for planning artifact.

Customer Perspective review status: required before Release Gate approval.

UX workflow testing status: required before Release Gate approval.

Compatibility testing status: required before Release Gate approval.

Production status: blocked until preview evidence, release gate, owner approval, rollback notes, and Super Admin status updates exist.

## Acceptance Criteria Evidence

- Public story intake, thank-you, optional account status, review queue, review detail, response work queue, admin settings/users, and Super Admin status surfaces are covered.
- Primary actions are named for story sharers, reviewers, admins, and volunteers.
- Mobile-first behavior, accessibility, contrast, spacing, and touch targets are addressed.
- Empty, error, loading, onboarding, and admin states are included.
- Compatibility follow-up risks are named for forms, auth redirects, touch targets, and admin responsive layouts.
- No implementation or generated app code was created.

## Machine Artifact

```json
{
  "agent": "designer",
  "status": "needs_follow_up",
  "summary": "UI design brief and design_review artifact completed for Spark of Hope Intake Lite. Release remains blocked pending Customer Perspective review, UX workflow testing, compatibility testing, release gate, and approved preview path.",
  "artifacts": [
    {
      "kind": "design_brief",
      "title": "Spark of Hope Intake Lite UI Design Brief",
      "content": {
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "architecturePath": "source-of-truth/architecture/spark-of-hope-intake-lite.md",
          "toolClassification": "direct_transformation",
          "targetVersion": "v1"
        },
        "purpose": "Help a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.",
        "audience": [
          "People sharing hopeful stories",
          "Church staff reviewing submitted stories",
          "Encouragement volunteers preparing a response",
          "AppEngine owner/admin users monitoring the pilot through Super Admin"
        ],
        "barrierRemoved": "Scattered, informal, or unsafe story collection.",
        "needAddressed": "A trusted way to share hopeful experiences and a responsible review and encouragement workflow.",
        "movementTowardLife": "Moves a story sharer from holding a story alone toward being heard, stewarded, and encouraged.",
        "transformationOutcome": "A calm, trusted story-intake workflow where hope is received responsibly and encouragement can be prepared safely.",
        "experienceIntent": "Calm, careful, practical, private by default, and emotionally present without becoming performative or content-driven.",
        "primaryJourneys": [
          "public_story_sharing",
          "optional_account_status",
          "review_workflow",
          "encouragement_workflow",
          "admin_stewardship",
          "super_admin_oversight"
        ],
        "screens": [
          "public_landing",
          "story_share_form",
          "privacy_explanation",
          "thank_you",
          "optional_account_status",
          "optional_story_status_detail",
          "admin_overview",
          "review_queue",
          "review_detail",
          "response_queue",
          "response_detail",
          "users",
          "settings",
          "incidents",
          "follow_ups",
          "super_admin_status"
        ],
        "stateChecks": [
          "empty_states",
          "loading_states",
          "error_states",
          "success_states",
          "onboarding",
          "admin_states",
          "super_admin_status"
        ],
        "mobileFirst": {
          "singleColumnPublicForm": true,
          "labelsAboveInputs": true,
          "minimumTouchTarget": "44x44 CSS pixels",
          "adminTablesBecomeCardsOnMobile": true,
          "noHoverRequired": true
        },
        "nonGoals": [
          "full Spark of Hope platform",
          "public story feed",
          "social network",
          "counseling or crisis workflow",
          "payments or fundraising",
          "church CRM",
          "uploads",
          "automated email delivery",
          "AI-generated encouragement"
        ]
      }
    },
    {
      "kind": "design_review",
      "title": "Spark of Hope Intake Lite Design Review",
      "content": {
        "kind": "design_review",
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "audience": [
            "People sharing hopeful stories",
            "Church staff reviewing submitted stories",
            "Encouragement volunteers preparing a response",
            "AppEngine owner/admin users monitoring the pilot through Super Admin"
          ]
        },
        "reviewers": {
          "designerRequired": true,
          "customerPerspectiveRequired": true,
          "designerStatus": "completed_for_planning_artifact",
          "customerPerspectiveStatus": "required"
        },
        "qualityChecks": [
          {
            "id": "simple_navigation",
            "status": "planned",
            "question": "Can each audience understand where they are and where to go next?"
          },
          {
            "id": "clear_primary_action",
            "status": "planned",
            "question": "Is the next best action obvious on public intake, review, response, admin, and Super Admin screens?"
          },
          {
            "id": "mobile_first_layout",
            "status": "planned",
            "question": "Does the workflow feel complete and comfortable on mobile?"
          },
          {
            "id": "readable_copy",
            "status": "planned",
            "question": "Is copy plain, human, and specific to this pilot?"
          },
          {
            "id": "accessible_spacing_contrast",
            "status": "planned",
            "question": "Are spacing, contrast, text size, focus states, and touch targets accessible?"
          },
          {
            "id": "trust_building_elements",
            "status": "planned",
            "question": "Does the experience explain privacy, consent, next steps, and safe boundaries?"
          },
          {
            "id": "audience_emotional_fit",
            "status": "planned",
            "question": "Does the app feel careful, hopeful, and practical without becoming generic or performative?"
          }
        ],
        "stateChecks": [
          "mobile",
          "empty states",
          "error states",
          "loading states",
          "success states",
          "onboarding",
          "admin screens",
          "Super Admin status"
        ],
        "uxReview": {
          "required": true,
          "status": "required",
          "surfaces": [
            "first screen",
            "main public workflow",
            "mobile workflow",
            "empty states",
            "error states",
            "loading states",
            "onboarding",
            "account/profile area",
            "admin screens",
            "Super Admin status surface",
            "monitoring and incident screens"
          ],
          "emotionalFit": "Calm, careful, trustworthy, and practical for a sensitive story intake and encouragement workflow.",
          "releaseBlockingIssues": [
            "Customer Perspective review is still required.",
            "Workflow UX testing is still required.",
            "Compatibility testing is still required before release approval."
          ]
        },
        "workflowTestChecks": [
          "public story sharing path",
          "mobile public form path",
          "validation failure path",
          "failed submission path",
          "thank-you path",
          "optional account status path",
          "admin review queue path",
          "review detail status transition path",
          "response preparation path",
          "admin users/settings path",
          "Super Admin status path"
        ],
        "guardrails": {
          "blocksReleaseGateApproval": true,
          "requiresDesignerReview": true,
          "requiresCustomerPerspectiveReview": true,
          "blocksUglyOrConfusingApps": true,
          "blocksPurposeBleed": true,
          "noProductionDeployWithoutApproval": true,
          "noSecretsInOutput": true
        }
      }
    }
  ],
  "findings": [
    {
      "severity": "medium",
      "title": "Release approval remains blocked by required reviews and tests",
      "details": "This phase creates the design brief and planning design_review only. Customer Perspective review, UX workflow testing, compatibility testing, and Release Gate evidence are still required before preview or release approval.",
      "recommendedLabel": "ai:review"
    }
  ],
  "followUpTasks": [
    {
      "title": "[spark-of-hope-intake-lite] Customer Perspective review",
      "recommendedLabel": "ai:review",
      "body": "## Customer Perspective Review: Spark of Hope Intake Lite\n\nReview the UI design brief from the target user's perspective before Release Gate approval.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/design/spark-of-hope-intake-lite.md\n- source-of-truth/design-quality-gate.md\n- source-of-truth/ux-review-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nCheck trust, comprehension, emotional fit, friction, privacy confidence, and whether story sharers, reviewers, admins, and volunteers can understand what to do without explanation.\n\n## Acceptance Criteria\n- Public intake, thank-you, review, response, admin, and Super Admin surfaces are reviewed from the intended audience perspective.\n- Release-blocking trust, copy, mobile, privacy, or emotional-fit issues are listed.\n- No UI code, deployment, provider provisioning, or production action occurs."
    },
    {
      "title": "[spark-of-hope-intake-lite] UX workflow test plan",
      "recommendedLabel": "ai:review",
      "body": "## UX Workflow Test Plan: Spark of Hope Intake Lite\n\nCreate the workflow test plan from the UI design brief before MVP release approval.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/data-model/spark-of-hope-intake-lite.md\n- source-of-truth/identity-auth/spark-of-hope-intake-lite.md\n- source-of-truth/design/spark-of-hope-intake-lite.md\n- source-of-truth/ux-review-standard.md\n- source-of-truth/compatibility-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nDefine workflow checks for public story sharing, mobile form completion, validation failure, thank-you, optional account status, admin review, response preparation, users/settings, incidents, follow-ups, and Super Admin status.\n\n## Acceptance Criteria\n- User, admin, volunteer, and Super Admin paths are testable.\n- Empty, error, loading, onboarding, and mobile paths are included.\n- Release-blocking UX gaps are listed.\n- No production deployment, real user data, provider provisioning, or generated app merge occurs."
    },
    {
      "title": "[spark-of-hope-intake-lite] Compatibility testing for forms, auth redirects, and admin responsive layout",
      "recommendedLabel": "ai:review",
      "body": "## Compatibility Testing: Spark of Hope Intake Lite\n\nCreate or run compatibility checks for the design risks named in the UI design brief.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/design/spark-of-hope-intake-lite.md\n- source-of-truth/compatibility-standard.md\n- source-of-truth/release-gate-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nVerify iPhone Safari, iPad Safari, desktop Safari, Chrome mobile, Chrome desktop, Edge desktop, Firefox desktop, required viewports, form validation, auth redirects, touch targets, duplicate-submit prevention, admin row-card layouts, and Super Admin status surfaces.\n\n## Acceptance Criteria\n- Required browsers and viewports are listed with pass/fail or blocked status.\n- Form, auth, touch target, and admin responsive risks are specifically checked.\n- Safari/mobile blockers are treated as release blockers.\n- No production deployment, provider provisioning, paid resources, secrets, or real user data are introduced."
    }
  ],
  "handoffTo": [
    "customer_perspective",
    "workflow_tester",
    "code_reviewer"
  ]
}
```
