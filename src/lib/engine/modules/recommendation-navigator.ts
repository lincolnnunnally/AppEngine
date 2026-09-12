// recommendation-navigator — next faithful step from a short profile.
// Mined from AppEngine opportunity-solution-path + Best Life routing.

import { simpleListModule } from "./simple-list.ts";

export const recommendationNavigatorModule = simpleListModule({
  slug: "recommendation-navigator",
  name: "Next step",
  flag: "FEATURE_NAVIGATOR",
  table: "navigator_notes",
  path: "/next-step",
  heading: "What's the next step?",
  blurb: "Write where someone is and the next helpful step — not a maze of options.",
  empty: "No next steps captured yet.",
  button: "Save this next step",
  fields: [
    { key: "whereTheyAre", column: "where_they_are", label: "Where they are now", kind: "textarea" },
    { key: "nextStep", column: "next_step", label: "The next faithful step" },
    { key: "whoHelps", column: "who_helps", label: "Who can walk with them" }
  ],
  titleField: "nextStep",
  bodyField: "whereTheyAre"
});
