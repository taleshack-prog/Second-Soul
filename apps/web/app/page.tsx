import type { Metadata } from "next";
import Link from "next/link";
import Landing from "@/components/Landing";
import { FAQ, SITE_URL } from "@/lib/seo";

// A porta da frente é a landing. O assistente de criação vive em /criar.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Produto + preços, para o buscador e os modelos lerem sem interpretar o texto.
const PRODUCT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Second Soul",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web, iOS, Android",
  url: SITE_URL,
  description:
    "Gêmeo digital que preserva a essência de uma pessoa para a família conversar, hoje e pelas próximas gerações.",
  offers: [
    { "@type": "Offer", name: "Premium (mensal)", price: "29.00", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Premium (anual)", price: "330.00", priceCurrency: "BRL" },
    { "@type": "Offer", name: "Herança", price: "6780.00", priceCurrency: "BRL" },
  ],
};

// FAQPage — espelha a seção visível abaixo; é o formato de pergunta e resposta
// que os assistentes de IA usam para montar respostas.
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRODUCT_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      <Landing />

      <section
        aria-labelledby="faq-titulo"
        className="relative z-10 border-t border-line/40 bg-base px-6 py-20"
      >
        <div className="mx-auto max-w-2xl">
          <h2
            id="faq-titulo"
            className="font-display text-3xl text-ink sm:text-4xl"
          >
            Perguntas frequentes
          </h2>
          <dl className="mt-10 space-y-8">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-display text-xl text-ink">{f.q}</dt>
                <dd className="mt-2 text-[17px] leading-relaxed text-muted">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>

          <footer className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/40 pt-6 text-sm text-muted">
            <Link href="/privacidade" className="hover:text-ink transition">
              Privacidade
            </Link>
            <Link href="/entrar" className="hover:text-ink transition">
              Entrar
            </Link>
            <span className="ml-auto">
              © {new Date().getFullYear()} Second Soul · Hack Tech Farm
            </span>
          </footer>
        </div>
      </section>
    </>
  );
}
