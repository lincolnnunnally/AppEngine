/** Live apps the owner deck has no usage number for. Same rule as the table. */

export type ReportingGapApp = {
  slug: string;
  name: string;
  status: string;
  reporting: boolean;
};

export function liveAppsNotReporting(apps: ReportingGapApp[]): { slug: string; name: string }[] {
  return apps
    .filter((app) => app.status === "live" && !app.reporting)
    .map((app) => ({ slug: app.slug, name: app.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
