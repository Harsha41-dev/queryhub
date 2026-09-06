import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/answer",
        "/api/",
        "/bookmarks",
        "/forgot-password",
        "/following",
        "/home",
        "/login",
        "/notifications",
        "/onboarding",
        "/register",
        "/reset-password",
        "/settings",
      ],
    },
    sitemap: `${appBaseUrl()}/sitemap.xml`,
  };
}
