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
import { joinWaitlist, me, startCheckout } from "@/lib/api";

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
    teaser: "Assine conforme usa, ou garanta para sempre.",
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
    period: "/mês · ou R$ 330/ano",
    blurb: "O produto completo, enquanto a assinatura durar.",
    features: [
      "Acervo multimodal ilimitado",
      "Conversa por texto e voz",
      "Álbum completo de recordações",
      "Compartilhe em vida e defina herdeiros",
      "Liberação pós-morte para herdeiros",
    ],
    highlight: false,
  },
  {
    name: "Herança",
    price: "R$ 6.780",
    period: "pagamento único",
    blurb: "Garanta para sempre, de uma vez — com respaldo de sucessão.",
    features: [
      "Tudo do Premium, sem mensalidade",
      "Guarda perpétua garantida",
      "Herdeiros e liberação pós-morte",
      "Respaldo jurídico à sucessão",
      "Selo de autenticidade (em breve)",
    ],
    highlight: true,
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
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    me().then((a) => setLoggedIn(!!a));
  }, []);

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
      <TopBar />

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
            <PlansPanel loggedIn={loggedIn} onJoin={() => setActive("waitlist")} />
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

function TopBar() {
  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <span className="font-display text-xl tracking-tight text-ink">Second Soul</span>
      <div className="flex items-center gap-4">
        <a
          href="/privacidade"
          className="hidden text-sm text-muted transition-colors hover:text-ink sm:inline"
        >
          Privacidade
        </a>
        <a
          href="/entrar"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          Entrar
        </a>
      </div>
    </header>
  );
}

/* ---------------- palco orbital (desktop) ---------------- */

function Orbital({ onOpen }: { onOpen: (id: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const galaxyRef = useRef<HTMLDivElement>(null);
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
        // órbita ELÍPTICA: usa a largura (que sobra) para espalhar os cards,
        // e um raio vertical menor limitado pela altura. Assim a galáxia fica
        // grande no centro e as luas bem afastadas, mesmo em janela baixa.
        const Rx = Math.min(w / 2 - 110, 580);
        const Ry = Math.min(h / 2 - 78, 420, Rx * 0.9);
        // galáxia GRANDE no centro. As luas se espalham pelos lados, então o
        // centro fica livre; as pontas de cima/baixo apenas tangenciam o halo.
        if (galaxyRef.current) {
          const d = Math.max(260, Math.min(Ry * 1.9, 640));
          galaxyRef.current.style.width = `${d}px`;
          galaxyRef.current.style.height = `${d}px`;
        }
        for (let i = 0; i < MOONS.length; i++) {
          const node = cardRefs.current[i];
          if (!node) continue;
          if (hovered.current !== i) angles.current[i] += speeds[i] * dt;
          const p = ease(Math.min(1, Math.max(0, (t - emergeDelay(i)) / EMERGE)));
          const a = angles.current[i];
          const x = Math.cos(a) * Rx * p;
          const y = Math.sin(a) * Ry * p;
          const scale = 0.65 + 0.35 * p;
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
          ref={galaxyRef}
          className="bg-cover bg-center"
          style={{
            width: "420px",
            height: "420px",
            backgroundImage: "url(/galaxy.webp)",
            // closest-side = círculo inscrito: some exatamente na borda e corta
            // os cantos do quadrado da imagem (que antes giravam visíveis).
            WebkitMaskImage: "radial-gradient(circle closest-side, #000 74%, transparent 99%)",
            maskImage: "radial-gradient(circle closest-side, #000 74%, transparent 99%)",
            animation: "spin-slow 170s linear infinite",
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
          className="group absolute left-1/2 top-1/2 z-10 w-36 rounded-xl border border-line/80 bg-surface/85 p-2.5 text-left backdrop-blur-sm transition-colors hover:border-soul hover:bg-surface"
        >
          <span className="text-xs font-medium text-soul">{m.title}</span>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{m.teaser}</p>
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
          className="mx-auto h-72 w-72 bg-cover bg-center"
          style={{
            backgroundImage: "url(/galaxy.webp)",
            WebkitMaskImage: "radial-gradient(circle, #000 55%, transparent 75%)",
            maskImage: "radial-gradient(circle, #000 55%, transparent 75%)",
            animation: "spin-slow 170s linear infinite",
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

function PlansPanel({ loggedIn, onJoin }: { loggedIn: boolean; onJoin: () => void }) {
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");

  async function buy(plan: "premium_month" | "premium_year" | "heranca") {
    setBusy(plan);
    setErr("");
    try {
      await startCheckout(plan); // redireciona para o Stripe
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao iniciar o pagamento.");
      setBusy("");
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Planos</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Pague conforme usa, ou garanta para sempre de uma vez. Compartilhar e
        herdeiros entram nos dois. Preços de lançamento, sujeitos a ajuste.
      </p>
      <div className="mt-5 space-y-3">
        {PLANS.map((p) => {
          const isHeranca = p.name === "Herança";
          return (
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

              {loggedIn ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {isHeranca ? (
                    <PlanButton
                      label="Comprar"
                      busy={busy === "heranca"}
                      onClick={() => buy("heranca")}
                      primary
                    />
                  ) : (
                    <>
                      <PlanButton
                        label="Assinar mensal"
                        busy={busy === "premium_month"}
                        onClick={() => buy("premium_month")}
                        primary
                      />
                      <PlanButton
                        label="Anual"
                        busy={busy === "premium_year"}
                        onClick={() => buy("premium_year")}
                      />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-sm text-soul">{err}</p>}

      {!loggedIn && (
        <button
          onClick={onJoin}
          className="mt-5 w-full rounded-full bg-soul px-4 py-2.5 text-sm font-medium text-[#241703] transition hover:brightness-110"
        >
          Entrar na lista de espera
        </button>
      )}
    </div>
  );
}

function PlanButton({
  label,
  busy,
  onClick,
  primary,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
        primary
          ? "bg-soul text-[#241703] hover:brightness-110"
          : "border border-line text-ink hover:border-soul/50"
      }`}
    >
      {busy ? "…" : label}
    </button>
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
