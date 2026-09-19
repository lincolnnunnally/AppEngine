import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];

  if (host === "dashboard.unitedundergod.org") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  if (host === "apps.unitedundergod.org") {
    // Human directory only. Do not rank the forest — send crawlers to each app.
    return {
      rules: { userAgent: "*", allow: "/", disallow: [] },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/inbox", "/reports"] },
    sitemap: "https://appengine.unitedundergod.org/sitemap.xml",
  };
}
