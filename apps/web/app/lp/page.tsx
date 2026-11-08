"use client";

/**
 * Landing /lp — versão ORBITAL.
 *
 * Conceito (Tales): a galáxia é a essência no centro, girando devagar; os cards
 * emergem das pontas e viram luas em órbita lenta. Tudo em órbita no desktop;
 * no celular, um fallback empilhado e legível.
 *
 * Posicionamento: gêmeo neural como instrumento sério de legado. Sem freemium.
 * CTA = lista de espera. Só promete o que o produto faz hoje.
 */

import { useEffect, useRef, useState } from "react";
import { joinWaitlist } from "@/lib/api";

/* ---------------- conteúdo ---------------- */

type Moon = {
  id: string;
  title: string;
  teaser: string;
  body: string[];
};

const MOONS: Moon[] = [
  {
    id: "essencia",
    title: "Não é um chatbot",
    teaser: "É um gêmeo que parte das suas memórias reais.",
    body: [
      "Um chatbot inventa um personagem que soa como você. O Second Soul faz o contrário: parte do que você realmente escreveu, gravou e decidiu, e aprende a pensar a partir disso.",
      "O resultado não é uma caricatura simpática — é uma presença que carrega o seu modo de ver o mundo.",
    ],
  },
  {
    id: "fidelidade",
    title: "Não inventa",
    teaser: "Se não sabe, ele diz que não sabe.",
    body: [
      "Um legado só vale se for verdadeiro. O gêmeo responde a partir do que você registrou — nunca costura memórias que não existiram nem enfeita o que não aconteceu.",
      "Quando não tem a resposta, ele admite, em vez de fabricar. É o que separa uma lembrança de uma ficção.",
    ],
  },
  {
    id: "como",
    title: "Como funciona",
    teaser: "Você conta, o gêmeo aprende, a essência conversa.",
    body: [
      "Você conta: memórias escritas, áudios, vídeos, fotos com as suas palavras — no seu ritmo.",
      "O gêmeo aprende o seu vocabulário, o seu tom e a sua árvore de decisões. Quanto mais você guarda, mais fiel ele fica.",
      "A essência conversa: quem você autorizar fala com o gêmeo por texto e por voz, e navega o álbum inteiro — em vida e depois.",
    ],
  },
  {
    id: "multimodal",
    title: "Multimodal & voz",
    teaser: "Texto, voz, vídeo e fotos — a pessoa inteira.",
    body: [
      "O acervo guarda a pessoa inteira, não frases soltas: texto, áudio, vídeo e imagens com as suas palavras ao lado.",
      "A conversa acontece por escrita ou por voz, para uma presença mais perto da real.",
    ],
  },
  {
    id: "legado",
    title: "Legado",
    teaser: "Para as gerações que vêm depois.",
    body: [
      "Cada familiar que entra soma — o valor cresce conforme a árvore da família se conecta.",
      "Você decide quem acessa e quando: em vida, ou liberado para herdeiros depois. Os dados são seus, para exportar ou apagar quando quiser.",
    ],
  },
  {
    id: "planos",
    title: "Planos",
    teaser: "Um legado não é assinatura descartável.",
    body: [],
  },
];

type Plan = {
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  highlight: boolean;
};

const PLANS: Plan[] = [
  {
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
    name: "Herança",
    price: "R$ 4.997",
    period: "pagamento único",
    blurb: "Para quem trata o legado como sucessão, com apoio jurídico.",
    features: [
      "Tudo do Vitalício",
      "50 anos de guarda garantida",
      "Herdeiros e liberação pós-morte",
      "Apoio à sucessão digital",
      "Selo de autenticidade (em breve)",
    ],
    highlight: false,
  },
];

/* estrelas de fundo — determinístico (mesmo no servidor e no cliente) */
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 10000;
    return x - Math.floor(x);
  };
  return {
    top: r(12.9898) * 100,
    left: r(78.233) * 100,
    size: 0.5 + r(3.1) * 1.6,
    op: 0.2 + r(5.7) * 0.6,
    dur: 3 + r(9.1) * 5,
  };
});

/* ---------------- página ---------------- */

export default function LandingPage() {
  const [mode, setMode] = useState<"stacked" | "orbital">("stacked");
  const [active, setActive] = useState<string | null>(null); // moon id, "waitlist", null

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setMode(mq.matches && !rm.matches ? "orbital" : "stacked");
    decide();
    mq.addEventListener("change", decide);
    rm.addEventListener("change", decide);
    return () => {
      mq.removeEventListener("change", decide);
      rm.removeEventListener("change", decide);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-base text-ink">
      <Starfield />
      <TopBar onJoin={() => setActive("waitlist")} />

      {mode === "orbital" ? (
        <Orbital onOpen={setActive} />
      ) : (
        <Stacked onOpen={setActive} />
      )}

      {active && (
        <Modal onClose={() => setActive(null)}>
          {active === "waitlist" ? (
            <WaitlistPanel />
          ) : active === "planos" ? (
            <PlansPanel />
          ) : (
            <MoonPanel moon={MOONS.find((m) => m.id === active)!} />
          )}
        </Modal>
      )}
    </main>
  );
}

/* ---------------- fundo de estrelas ---------------- */

function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.op,
            animation: `twinkle ${s.dur}s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.8}}
        @keyframes spin-slow{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ---------------- barra superior ---------------- */

function TopBar({ onJoin }: { onJoin: () => void }) {
  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <span className="font-display text-xl tracking-tight text-ink">Second Soul</span>
      <button
        onClick={onJoin}
        className="rounded-full bg-soul px-4 py-2 text-sm font-medium text-[#241703] transition hover:brightness-110"
      >
        Entrar na lista
      </button>
    </header>
  );
}

/* ---------------- palco orbital (desktop) ---------------- */

function Orbital({ onOpen }: { onOpen: (id: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const angles = useRef<number[]>(MOONS.map((_, i) => (i / MOONS.length) * Math.PI * 2));
  const hovered = useRef<number | null>(null);
  const start = useRef<number>(0);

  useEffect(() => {
    let raf = 0;
    const speeds = MOONS.map((_, i) => 0.05 + (i % 3) * 0.015); // rad/s, variado
    const emergeDelay = (i: number) => 0.35 + i * 0.45;
    const EMERGE = 1.3;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let last = 0;

    const frame = (now: number) => {
      if (!start.current) start.current = now;
      const t = (now - start.current) / 1000;
      const dt = last ? (now - last) / 1000 : 0;
      last = now;

      const stage = stageRef.current;
      if (stage) {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const S = Math.min(w, h) / 2;
        const R = S - 72; // raio da órbita, deixando margem pros cards
        for (let i = 0; i < MOONS.length; i++) {
          const node = cardRefs.current[i];
          if (!node) continue;
          if (hovered.current !== i) angles.current[i] += speeds[i] * dt;
          const p = ease(Math.min(1, Math.max(0, (t - emergeDelay(i)) / EMERGE)));
          const radius = R * (0.9 + (i % 2) * 0.12) * p;
          const a = angles.current[i];
          const x = Math.cos(a) * radius;
          const y = Math.sin(a) * radius * 0.82; // leve achatamento elíptico
          const scale = 0.6 + 0.4 * p;
          node.style.transform = `translate(-50%,-50%) translate(${x}px, ${y}px) scale(${scale})`;
          node.style.opacity = String(p);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={stageRef}
      className="relative mx-auto flex h-[calc(100vh-72px)] max-w-6xl items-center justify-center"
    >
      {/* galáxia */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-[46vmin] w-[46vmin] max-h-[560px] max-w-[560px] bg-cover bg-center"
          style={{
            backgroundImage: "url(/galaxy.webp)",
            WebkitMaskImage: "radial-gradient(circle, #000 55%, transparent 74%)",
            maskImage: "radial-gradient(circle, #000 55%, transparent 74%)",
            animation: "spin-slow 240s linear infinite",
          }}
        />
      </div>

      {/* nome no coração da galáxia */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
        <h1 className="font-display text-2xl text-ink drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-3xl">
          Second Soul
        </h1>
        <p className="mt-1 text-xs text-ink/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          O seu jeito de pensar, preservado.
        </p>
      </div>

      {/* luas */}
      {MOONS.map((m, i) => (
        <button
          key={m.id}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          onClick={() => onOpen(m.id)}
          onMouseEnter={() => (hovered.current = i)}
          onMouseLeave={() => (hovered.current = null)}
          style={{ opacity: 0 }}
          className="group absolute left-1/2 top-1/2 z-10 w-44 rounded-2xl border border-line/80 bg-surface/80 p-3.5 text-left backdrop-blur-sm transition-colors hover:border-soul hover:bg-surface"
        >
          <span className="text-[13px] font-medium text-soul">{m.title}</span>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">{m.teaser}</p>
        </button>
      ))}

      <p className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-xs text-muted">
        toque numa lua para explorar
      </p>
    </div>
  );
}

/* ---------------- fallback empilhado (celular / reduced-motion) ---------------- */

function Stacked({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="relative z-10 mx-auto max-w-xl px-5 pb-16">
      <div className="relative py-10 text-center">
        <div
          className="mx-auto h-56 w-56 bg-cover bg-center"
          style={{
            backgroundImage: "url(/galaxy.webp)",
            WebkitMaskImage: "radial-gradient(circle, #000 55%, transparent 75%)",
            maskImage: "radial-gradient(circle, #000 55%, transparent 75%)",
            animation: "spin-slow 240s linear infinite",
          }}
        />
        <h1 className="mt-4 font-display text-3xl leading-tight text-ink">
          O seu jeito de pensar,
          <br />
          preservado em um <span className="text-soul">gêmeo neural</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
          Não é um chatbot com a sua foto. É um gêmeo que aprende as suas memórias
          e segue conversando com quem você ama — hoje e depois.
        </p>
      </div>

      <div className="space-y-3">
        {MOONS.map((m) => (
          <button
            key={m.id}
            onClick={() => onOpen(m.id)}
            className="block w-full rounded-2xl border border-line bg-surface/70 p-4 text-left transition-colors hover:border-soul/60"
          >
            <span className="text-sm font-medium text-soul">{m.title}</span>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{m.teaser}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-soul/40 bg-surface/60 p-5 text-center">
        <p className="text-[15px] text-ink">Entre na lista de espera.</p>
        <p className="mt-1 text-sm text-muted">Avisamos quando o cadastro abrir.</p>
        <div className="mt-4">
          <WaitlistForm />
        </div>
      </div>
    </div>
  );
}

/* ---------------- modal + painéis ---------------- */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl sm:p-8"
      >
        {children}
        <button
          onClick={onClose}
          className="mt-6 text-sm text-muted transition-colors hover:text-ink"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

function MoonPanel({ moon }: { moon: Moon }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">{moon.title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
        {moon.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

function PlansPanel() {
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Planos</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Um legado não é assinatura descartável — por isso há posse definitiva, não
        só mensalidade. Preços de lançamento, sujeitos a ajuste.
      </p>
      <div className="mt-5 space-y-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-4 ${
              p.highlight ? "border-soul bg-base" : "border-line bg-base/50"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg text-ink">{p.name}</h3>
              <div className="text-right">
                <span className="text-xl font-semibold text-ink">{p.price}</span>{" "}
                <span className="text-xs text-muted">{p.period}</span>
              </div>
            </div>
            <p className="mt-1 text-[13px] text-muted">{p.blurb}</p>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] text-ink/85">
                  <span className="text-soul">·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaitlistPanel() {
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">
        Comece a eternizar o que não cabe numa foto.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        O Second Soul está em fase final de testes. Entre na lista de espera e
        avisamos assim que o cadastro abrir.
      </p>
      <div className="mt-6">
        <WaitlistForm />
      </div>
    </div>
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
        className="flex-1 rounded-full border border-line bg-base px-5 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="rounded-full bg-soul px-6 py-3 font-medium text-[#241703] transition hover:brightness-110 disabled:opacity-50"
      >
        {state === "busy" ? "…" : "Entrar"}
      </button>
      {state === "error" && (
        <p className="w-full text-center text-sm text-soul sm:text-left">{msg}</p>
      )}
    </form>
  );
}
