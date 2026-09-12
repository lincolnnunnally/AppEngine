// feedback-pulse — issues and voice for leaders. Mined from Pulse.

import { simpleListModule } from "./simple-list.ts";

export const feedbackPulseModule = simpleListModule({
  slug: "feedback-pulse",
  name: "Pulse",
  flag: "FEATURE_PULSE",
  table: "pulse_notes",
  path: "/pulse",
  heading: "What people are seeing",
  blurb: "Capture a real issue in plain words so leaders are not flying blind.",
  empty: "No pulse notes yet.",
  button: "Share this",
  fields: [
    { key: "title", column: "title", label: "What's happening" },
    { key: "detail", column: "detail", label: "More detail", kind: "textarea" },
    { key: "place", column: "place", label: "Where" },
    { key: "status", column: "status", label: "Status (open / heard)" }
  ],
  titleField: "title",
  bodyField: "detail"
});
