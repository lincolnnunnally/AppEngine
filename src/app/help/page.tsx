import { HelpForm } from "@/components/help/help-form";
import { listHelpApps } from "@/lib/engine/app-ops-catalog";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { auth } from "@/auth";
import { normalizeUserKey } from "@/lib/engine/billing";
import { listBuildJobsForUser } from "@/lib/engine/build-jobs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Need a hand?",
  description: "Tell us what is going wrong. A real person will read it and get back to you."
};

export default async function HelpPage({
  searchParams
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const board = getPortfolioUrlStatusBoard();
  const names = new Map(board.entries.map((entry) => [entry.slug, entry.appName]));
  const apps = listHelpApps()
    .map((entry) => ({
      slug: entry.slug,
      name: names.get(entry.slug) || entry.slug
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // A customer's own apps lead the list, so help about an app they bought here
  // reaches the owner already labelled with which app it is.
  const session = await auth().catch(() => null);
  const userKey = normalizeUserKey(session?.user?.email);
  const builds = userKey ? await listBuildJobsForUser(userKey).catch(() => []) : [];
  const ownApps = builds
    .filter((job) => job.vercelProject || job.url)
    .map((job) => ({ slug: `customer-${job.vercelProject || job.id}`, name: `Your app: ${job.idea.slice(0, 60)}` }));
  apps.unshift(...ownApps, { slug: "appengine-customer", name: "An app I built with App Engine" });
  const initial = apps.some((entry) => entry.slug === params.app) ? params.app || "other" : ownApps[0]?.slug || params.app || "other";

  return (
    <main className="shell help-shell">
      <section className="panel">
        <p className="dx-label">Help</p>
        <h1 className="dx-display">
          Need a <em>hand</em>?
        </h1>
        <p className="dx-lede">
          If something on one of these apps is broken, confusing, or just not working for you — say so. This goes to a
          real person. You will get a reply.
        </p>
      </section>
      <section className="panel">
        <HelpForm apps={apps} initialApp={initial} />
      </section>
    </main>
  );
}
