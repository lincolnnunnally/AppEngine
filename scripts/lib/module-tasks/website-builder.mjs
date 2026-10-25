// Website builder: the owner builds a landing page; a signed-out visitor can
// open it at /s/<slug> only once it is published (never as a draft, never after
// it is unpublished), and two pages with the same name each keep their own
// address — a visitor sent to one never lands on the other. The owner's site
// record is saved and can go live. The job is "people can find us online".
import { api, expectText } from "./_helpers.mjs";

async function expectNotPublic(visitor, url, secret, what) {
  const res = await visitor.goto(url, { waitUntil: "domcontentloaded" });
  const body = await visitor.locator("body").innerText();
  if (res && res.status() < 400 && body.includes(secret)) throw new Error(`${what}: a signed-out visitor can read it at ${new URL(url).pathname}`);
  if (res && res.status() !== 404) throw new Error(`${what}: ${new URL(url).pathname} answered ${res.status()}, expected 404`);
}

export async function task({ page, base, visitor }) {
  // 1. The owner saves a draft landing page.
  const created = await api(page, "POST", `${base}/api/website/landing`, {
    brandName: "Prove Chapel",
    headline: "Come as you are this Sunday",
    subheadline: "Services at 9 and 11.",
    ctaLabel: "Plan a visit",
    features: ["Kids ministry", "Coffee after service"]
  });
  const landing = created.page;
  if (!landing?.id || !landing.slug) throw new Error("creating a landing page returned no id/slug");
  if (landing.published) throw new Error("a new landing page is published before the owner ships it");
  const publicUrl = `${base}/s/${landing.slug}`;
  await expectText(page, `${base}/website/landing/${landing.id}`, "Draft", "the owner sees the page as a draft");

  // 2. Not public while a draft — by slug or by id.
  await expectNotPublic(visitor, publicUrl, "Come as you are this Sunday", "a draft landing page");
  await expectNotPublic(visitor, `${base}/s/${landing.id}`, "Come as you are this Sunday", "a draft landing page (by id)");

  // 3. Publish → a signed-out visitor sees the real content.
  await api(page, "PATCH", `${base}/api/website/landing/${landing.id}`, { published: true });
  await expectText(visitor, publicUrl, "Come as you are this Sunday", "a visitor opens the published page");
  await expectText(visitor, publicUrl, "Coffee after service", "the visitor sees the page's own features");
  await expectText(page, `${base}/website/landing/${landing.id}`, `/s/${landing.slug}`, "the owner is shown the public address");

  // 4. A second page with the same name gets its own address; the first
  //    address still shows the first page.
  const second = (await api(page, "POST", `${base}/api/website/landing`, {
    brandName: "Prove Chapel",
    headline: "Christmas Eve candlelight service",
    published: true
  })).page;
  if (!second?.slug) throw new Error("creating a second landing page returned no slug");
  if (second.slug === landing.slug) throw new Error(`two landing pages share the address /s/${landing.slug}`);
  await expectText(visitor, publicUrl, "Come as you are this Sunday", "the first page's address still shows the first page");
  await expectText(visitor, `${base}/s/${second.slug}`, "Christmas Eve candlelight service", "the second page has its own address");

  // 5. Unpublish → gone for visitors again.
  await api(page, "PATCH", `${base}/api/website/landing/${landing.id}`, { published: false });
  await expectNotPublic(visitor, publicUrl, "Come as you are this Sunday", "an unpublished landing page");

  // 6. The owner's site record is saved, listed, and can go live.
  const site = (await api(page, "POST", `${base}/api/website`, { siteName: "Prove Chapel Site", domainName: "provechapel.org", domainChoice: "custom" })).site;
  if (!site?.id) throw new Error("creating a site returned no id");
  await expectText(page, `${base}/website`, "Prove Chapel Site", "the owner sees the site in their list");
  await api(page, "PATCH", `${base}/api/website/${site.id}`, { status: "active" });
  const live = await api(page, "GET", `${base}/api/website/${site.id}`);
  if (live.site?.status !== "active" || !live.site?.deploymentDate) throw new Error(`site is "${live.site?.status}" with no go-live date after going live`);
}
