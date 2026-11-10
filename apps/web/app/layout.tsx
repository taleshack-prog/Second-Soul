import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

const DESCRIPTION =
  "O Second Soul preserva a essência de uma pessoa — memórias, voz e jeito de pensar — num gêmeo digital com quem a família conversa, hoje e pelas próximas gerações.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Second Soul — Preserve uma essência",
    template: "%s — Second Soul",
  },
  description: DESCRIPTION,
  applicationName: "Second Soul",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Second Soul",
    title: "Second Soul — Preserve uma essência",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Second Soul — Preserve uma essência",
    description: DESCRIPTION,
  },
};

// JSON-LD de identidade do site (Organization + WebSite), lido pelo Google e
// pelos modelos de IA sem precisar interpretar o texto.
const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Second Soul",
      url: SITE_URL,
      description: DESCRIPTION,
      parentOrganization: {
        "@type": "Organization",
        name: "Hack Tech Farm",
        url: "https://hacktechfarm.com.br",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Second Soul",
      url: SITE_URL,
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable} font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />
        {children}
      </body>
    </html>
  );
}
