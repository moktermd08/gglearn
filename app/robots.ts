import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/publicCatalog";

/** Keeps crawlers out of anything personal or behind sign-in; certificates and share cards are reached by their link, not by search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/dashboard", "/profile", "/notifications", "/run/", "/role-exam/", "/start", "/journey", "/rewards", "/achievements", "/updates", "/join/", "/t/", "/teams", "/league", "/d/", "/friends", "/f/", "/m/", "/mentoring", "/p/", "/sp/", "/sponsoring", "/sso", "/auth/", "/forgot", "/reset/", "/signin", "/search", "/unsubscribe/", "/cert/", "/s/", "/login", "/competitions/new"] },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
