import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";
import { sitePagePaths } from "@/i18n/routing";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return sitePagePaths().map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path.endsWith("/en/") ? 1 : 0.8,
  }));
}
