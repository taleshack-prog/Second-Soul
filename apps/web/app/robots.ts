import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// robots.txt — o primeiro arquivo que todo robô lê. Libera o conteúdo público
// e mantém as rotas de app/privadas fora do índice.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/meus-acervos", "/criar", "/entrar", "/essencia/", "/s/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
