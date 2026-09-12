// domains-publishing — request and track a public web address for the app.
// Mined from EasyPeazy DomainSearchModal + AppEngine domain attach.

import { simpleListModule } from "./simple-list.ts";

export const domainsPublishingModule = simpleListModule({
  slug: "domains-publishing",
  name: "Domains",
  flag: "FEATURE_DOMAINS",
  table: "domain_requests",
  path: "/domains",
  heading: "Your web address",
  blurb: "Ask for a public address people can type. We track the request until it is live.",
  empty: "No domain requests yet.",
  button: "Request this address",
  fields: [
    { key: "hostname", column: "hostname", label: "Address (example.com)" },
    { key: "notes", column: "notes", label: "Notes", kind: "textarea" },
    { key: "status", column: "status", label: "Status (requested / live)" }
  ],
  titleField: "hostname",
  bodyField: "status"
});
