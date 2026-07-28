// growth-telemetry — every app the factory builds is born able to report how it
// is actually doing. Foundation tier: this is not an option an app opts into.
//
// The ecosystem spent its first year shipping apps with no measurement at all,
// which meant nobody could tell a working funnel from a broken one, and the
// agent council had nothing to improve against except Lincoln's own bug reports.
// This module closes that: the generated app posts the canonical funnel
// (page_view -> signup_started -> signup_completed -> activated ->
// payment_completed) to the shared `ecosystem-telemetry` edge function, which is
// the same endpoint every pre-existing app was retrofitted onto.
//
// The emitted client is a byte-for-byte copy of the canonical source at
// shared-client/lpl-telemetry/. smoke-growth-telemetry.js fails the build if the
// two drift, so a bug only ever has one home.
//
// One deploy-time step remains for a new app: its slug must exist in
// `lpl_app_registry`, or the ingest function rejects its events by design.
// `npm run growth:register -- <slug> <url>` does that.

import type { AppModule, GeneratedModuleFile } from "./types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = join(process.cwd(), "shared-client", "lpl-telemetry");

// Read the canonical client at generation time rather than keeping a second copy
// inline. The generator runs in the AppEngine server process, where these files
// are always present; if that ever stops being true we want a loud failure at
// build time, not silently un-instrumented apps.
function canonical(name: string): string {
  return readFileSync(join(CLIENT_DIR, name), "utf8");
}

function file(path: string, content: string): GeneratedModuleFile {
  return { path, content };
}

export const growthTelemetryModule: AppModule = {
  slug: "growth-telemetry",
  name: "Growth Telemetry",
  tier: "foundation",

  files: () => [
    file("src/lib/telemetry.ts", canonical("telemetry.ts")),
    // Not "Telemetry.tsx": macOS is case-insensitive, so that name collides with
    // telemetry.ts and TypeScript resolves the import to the wrong module.
    file("src/lib/TelemetryProvider.tsx", canonical("TelemetryProvider.tsx")),
    file(
      "src/lib/telemetry-README.md",
      [
        "# Telemetry in this app",
        "",
        "`<Telemetry />` in `src/app/layout.tsx` reports a `page_view` on every route",
        "change. That is the top of the funnel and it works with no further wiring.",
        "",
        "Report the rest of the funnel from the places those things actually happen:",
        "",
        "```ts",
        'import { funnel, identify } from "@/lib/telemetry";',
        "",
        "funnel.signupStarted();               // the signup form is opened",
        "funnel.signupCompleted();             // the account now exists",
        "funnel.activated();                   // first real core action",
        "funnel.paymentCompleted({ plan });    // money changed hands",
        "identify(user.id);                    // opaque id only — never an email",
        "```",
        "",
        "`activated` is the one step that means something different per app — the",
        "first action that shows the app worked for this person. Record which action",
        "that is in `lpl_app_registry.activation_event` so the growth loop can read",
        "the funnel correctly.",
        "",
        "No raw IP or user-agent string is ever stored, and events are dropped",
        "entirely when the browser sends Do Not Track.",
        ""
      ].join("\n") + "\n"
    )
  ],

  envLines: () => [
    "# Telemetry posts to the shared ecosystem endpoint; no key is needed.",
    "# Set this only to point a fork at a different ingest.",
    'NEXT_PUBLIC_TELEMETRY_ENDPOINT=""'
  ]
};
