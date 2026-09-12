// waitlist-invites — people waiting, invited when a door opens. Mined from Plenty ZIP/family invites.

import { simpleListModule } from "./simple-list.ts";

export const waitlistInvitesModule = simpleListModule({
  slug: "waitlist-invites",
  name: "Waitlist",
  flag: "FEATURE_WAITLIST",
  table: "waitlist_people",
  path: "/waitlist",
  heading: "Who is waiting",
  blurb: "Keep names and a place (ZIP or neighborhood). When a door opens, invite them.",
  empty: "No one is on the waitlist.",
  button: "Add to the waitlist",
  fields: [
    { key: "name", column: "name", label: "Name" },
    { key: "place", column: "place", label: "ZIP or neighborhood" },
    { key: "need", column: "need", label: "What they need", kind: "textarea" },
    { key: "status", column: "status", label: "Status (waiting / invited)" }
  ],
  titleField: "name",
  bodyField: "place"
});
