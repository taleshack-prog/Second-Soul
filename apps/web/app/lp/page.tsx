"use client";

/**
 * Landing /lp — prévia da página de venda.
 *
 * Posicionamento (decidido com Tales): o gêmeo neural como instrumento sério
 * de legado/sucessão. Diferenciação técnica + propósito de preservar o legado.
 * Sem freemium. CTA = lista de espera (até o Stripe entrar).
 *
 * Honestidade: só promete o que o produto faz hoje. Nada de blockchain ou
 * fine-tuning que ainda não existem.
 */

import { useState } from "react";
import { joinWaitlist } from "@/lib/api";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-base text-ink">
      <Nav />
      <Hero />
      <NotAChatbot />
      <How />
      <Fidelity />
      <Differentiators />
      <Plans />
      <Privacy />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ---------------- navegação ---------------- */

function Nav() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
      <span className="font-display text-xl tracking-tight text-ink">
        Second Soul
      </span>
      <a
        href="#planos"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        Planos
      </a>
    </header>
  );
}

/* ---------------- hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* brilho dourado difuso ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, #E8B060 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-16 text-center sm:pt-24">
        <p className="text-xs uppercase tracking-[0.25em] text-soul">
          Legado · Memória · Continuidade
        </p>
        <h1 className="mt-6 font-display text-[2.6rem] leading-[1.08] text-ink sm:text-6xl">
          O seu jeito de pensar,
          <br />
          preservado em um{" "}
          <span className="text-soul">gêmeo neural</span>.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-muted sm:text-lg">
          Não é um chatbot com a sua foto. É um gêmeo digital que aprende as suas
          memórias, os seus valores e as suas decisões — e segue conversando com
          quem você ama, hoje e nas gerações que vêm depois.
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <WaitlistForm />
          <p className="mt-3 text-xs text-muted">
            Em fase final de testes. Entre na lista para ser avisado quando abrir.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- não é um chatbot ---------------- */

function NotAChatbot() {
  return (
    <Section>
      <div className="grid gap-10 sm:grid-cols-2 sm:items-center">
        <div>
          <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
            A diferença entre imitar e lembrar.
          </h2>
        </div>
        <div className="space-y-4 text-[16px] leading-relaxed text-muted">
          <p>
            Um chatbot genérico inventa um personagem que soa como você. O Second
            Soul faz o contrário: parte das suas memórias reais — o que você
            escreveu, gravou, decidiu — e aprende a pensar a partir delas.
          </p>
          <p>
            O resultado não é uma caricatura simpática. É uma presença que carrega
            o seu modo de ver o mundo, para quem precisar dele quando você não
            puder mais responder pessoalmente.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- como funciona ---------------- */

function How() {
  const steps = [
    {
      n: "01",
      t: "Você conta",
      d: "Memórias escritas, áudios, vídeos, fotos com as suas palavras ao lado. Aos poucos, no seu ritmo — cada fragmento vira parte da essência.",
    },
    {
      n: "02",
      t: "O gêmeo aprende",
      d: "Ele absorve o seu vocabulário, o seu tom, os seus valores e a sua árvore de decisões. Quanto mais você guarda, mais fiel ele fica a você.",
    },
    {
      n: "03",
      t: "A essência conversa",
      d: "Quem você autorizar conversa com o gêmeo por texto e por voz, e navega o álbum inteiro de recordações — em vida e depois.",
    },
  ];
  return (
    <Section>
      <SectionEyebrow>Como funciona</SectionEyebrow>
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n}>
            <span className="font-display text-2xl text-soul">{s.n}</span>
            <h3 className="mt-3 text-lg font-medium text-ink">{s.t}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- fidelidade (o trunfo real) ---------------- */

function Fidelity() {
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <SectionEyebrow>Fidelidade</SectionEyebrow>
        <h2 className="mt-5 font-display text-3xl leading-tight text-ink sm:text-4xl">
          Ele não inventa. Se não sabe, diz que não sabe.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-muted">
          Um legado só vale se for verdadeiro. O gêmeo responde a partir do que
          você realmente registrou — nunca costura memórias que não existiram
          nem enfeita o que não aconteceu. Quando não tem a resposta, ele admite,
          em vez de fabricar. É o que separa uma lembrança de uma ficção.
        </p>
      </div>
    </section>
  );
}

/* ---------------- diferenciais ---------------- */

function Differentiators() {
  const items = [
    {
      t: "Multimodal",
      d: "Texto, voz, vídeo e fotos — o acervo guarda a pessoa inteira, não só frases soltas.",
    },
    {
      t: "Voz própria",
      d: "A conversa acontece por escrita ou por voz, para uma presença mais perto da real.",
    },
    {
      t: "Efeito geracional",
      d: "Cada familiar que entra soma. O valor cresce conforme a árvore da família se conecta.",
    },
    {
      t: "Você no controle",
      d: "Os dados são seus: dá para exportar tudo, ou apagar tudo, quando quiser.",
    },
  ];
  return (
    <Section>
      <SectionEyebrow>Por que o Second Soul</SectionEyebrow>
      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.t} className="border-l-2 border-soul/40 pl-5">
            <h3 className="text-lg font-medium text-ink">{i.t}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{i.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- planos ---------------- */

function Plans() {
  const plans = [
    {
      id: "premium",
      name: "Premium",
      price: "R$ 29",
      period: "/mês",
      blurb: "Para construir e conviver com a essência no dia a dia.",
      features: [
        "Acervo multimodal ilimitado",
        "Conversa por texto e voz",
        "Álbum completo de recordações",
        "Convidados em vida",
      ],
      highlight: false,
    },
    {
      id: "vitalicio",
      name: "Vitalício",
      price: "R$ 1.497",
      period: "pagamento único",
      blurb: "Pague uma vez; a essência permanece, sem mensalidade.",
      features: [
        "Tudo do Premium, para sempre",
        "Sem cobrança recorrente",
        "Prioridade em novos recursos",
      ],
      highlight: true,
    },
    {
      id: "heranca",
      name: "Herança",
      price: "R$ 4.997",
      period: "pagamento único",
      blurb: "Para quem trata o legado como sucessão, com apoio jurídico.",
      features: [
        "Tudo do Vitalício",
        "50 anos de guarda garantida",
        "Herdeiros e liberação pós-morte",
        "Apoio à sucessão digital",
      ],
      highlight: false,
    },
  ];
  return (
    <Section id="planos">
      <div className="text-center">
        <SectionEyebrow>Planos</SectionEyebrow>
        <h2 className="mt-5 font-display text-3xl leading-tight text-ink sm:text-4xl">
          Um legado não é assinatura descartável.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
          Por isso há planos de posse definitiva, não só mensalidade. Preços de
          lançamento, sujeitos a ajuste.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col rounded-2xl border p-6 ${
              p.highlight
                ? "border-soul bg-surface"
                : "border-line bg-surface/50"
            }`}
          >
            {p.highlight && (
              <span className="mb-3 inline-block w-fit rounded-full bg-soul/15 px-3 py-1 text-[11px] uppercase tracking-wide text-soul">
                Mais escolhido
              </span>
            )}
            <h3 className="font-display text-2xl text-ink">{p.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-ink">{p.price}</span>
              <span className="text-sm text-muted">{p.period}</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.blurb}</p>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[14px] text-ink/85">
                  <span className="mt-0.5 text-soul">·</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <a
                href="#lista"
                className={`block rounded-full px-4 py-2.5 text-center text-sm font-medium transition ${
                  p.highlight
                    ? "bg-soul text-[#241703] hover:brightness-110"
                    : "border border-line text-ink hover:border-soul/50"
                }`}
              >
                Entrar na lista
              </a>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- privacidade ---------------- */

function Privacy() {
  return (
    <Section>
      <div className="rounded-2xl border border-line bg-surface/40 p-8 text-center sm:p-10">
        <h2 className="font-display text-2xl text-ink sm:text-3xl">
          O que você guarda aqui é seu.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Memórias são o dado mais íntimo que existe. Você mantém o controle:
          pode levar tudo embora ou apagar tudo, a qualquer momento. Tratamos
          privacidade como a espinha do produto, não como letra miúda.
        </p>
      </div>
    </Section>
  );
}

/* ---------------- CTA final ---------------- */

function FinalCta() {
  return (
    <section id="lista" className="relative overflow-hidden border-t border-line">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-[-40%] h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, #E8B060 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Comece a eternizar o que não cabe numa foto.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
          Entre na lista de espera. Avisamos assim que o cadastro abrir.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}

/* ---------------- formulário da lista ---------------- */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("busy");
    setMsg("");
    try {
      await joinWaitlist(email.trim().toLowerCase());
      setState("done");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Tente de novo.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-full border border-soul/40 bg-soul/10 px-5 py-3 text-center text-sm text-ink">
        Pronto — você está na lista. A gente te avisa.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="flex-1 rounded-full border border-line bg-surface px-5 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="rounded-full bg-soul px-6 py-3 font-medium text-[#241703] transition hover:brightness-110 disabled:opacity-50"
      >
        {state === "busy" ? "…" : "Entrar na lista"}
      </button>
      {state === "error" && (
        <p className="w-full text-center text-sm text-soul sm:text-left">{msg}</p>
      )}
    </form>
  );
}

/* ---------------- rodapé ---------------- */

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row">
        <span className="font-display text-ink">Second Soul</span>
        <span>Um produto Hack Tech Farm</span>
        <a href="/privacidade" className="transition-colors hover:text-ink">
          Privacidade
        </a>
      </div>
    </footer>
  );
}

/* ---------------- utilitários de layout ---------------- */

function Section({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-5 py-20">
      {children}
    </section>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.25em] text-soul">{children}</p>
  );
}
