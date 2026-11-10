import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// sitemap.xml com data de atualização — os assistentes de IA e o Google
// preferem conteúdo recente, e o lastModified informa isso.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacidade`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
