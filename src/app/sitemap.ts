import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];

  if (host === "apps.unitedundergod.org") {
    return [{ url: "https://apps.unitedundergod.org/", changeFrequency: "weekly", priority: 1 }];
  }

  return [
    { url: "https://appengine.unitedundergod.org/", changeFrequency: "weekly", priority: 1 },
  ];
}
