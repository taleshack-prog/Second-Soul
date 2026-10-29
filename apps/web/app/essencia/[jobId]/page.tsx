"use client";

/**
 * A tela da essência — o coração do Second Soul.
 *
 * É aqui que o herdeiro, o filho, o neto chega e VIVE a essência: o álbum
 * inteiro de recordações e a conversa com o gêmeo, por escrita e por voz.
 * Diferente do wizard (que é construção), esta tela é só experiência —
 * reverente, sem controles de edição.
 */

import { useEffect, useRef, useState } from "react";
import {
  fetchSession,
  fetchPieces,
  pieceImageUrl,
  twinReady,
  twinTalk,
  transcribeVoice,
  type Piece,
  type TwinReady,
} from "@/lib/api";

type Msg = { from: "you" | "twin"; text: string };
type Tab = "conversa" | "album";

export default function EssenciaPage({ params }: { params: { jobId: string } }) {
  const jobId = params.jobId;
  const [name, setName] = useState("");
  const [found, setFound] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("conversa");

  useEffect(() => {
    fetchSession(jobId)
      .then((s) => {
        setFound(s.found);
        setName(s.person_name || "");
      })
      .catch(() => setFound(false));
  }, [jobId]);

  if (found === false) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl text-ink">Essência não encontrada</h1>
          <p className="mt-3 text-muted">
            Confira o link — ele é a chave para este acervo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-soul">A essência de</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-ink">
          {name || "—"}
        </h1>
      </header>

      <nav className="mt-8 flex justify-center gap-1 rounded-full border border-line bg-surface p-1">
        <TabButton active={tab === "conversa"} onClick={() => setTab("conversa")}>
          Conversar
        </TabButton>
        <TabButton active={tab === "album"} onClick={() => setTab("album")}>
          Álbum
        </TabButton>
      </nav>

      <div className="mt-8">
        {tab === "conversa" ? (
          <Conversa jobId={jobId} name={name} />
        ) : (
          <Album jobId={jobId} name={name} />
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-6 py-2 text-sm font-medium transition ${
        active ? "bg-soul text-[#241703]" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ======================= CONVERSA (texto + voz) ======================= */

function Conversa({ jobId, name }: { jobId: string; name: string }) {
  const [ready, setReady] = useState<TwinReady>({ status: "building" });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speak, setSpeak] = useState(false); // ouvir as respostas em voz
  const endRef = useRef<HTMLDivElement>(null);

  // gravação de voz
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const quem = name || "a essência";

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await twinReady(jobId);
      if (!alive) return;
      setReady(r);
      if (r.status === "building" || r.status === "missing") setTimeout(tick, 1200);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [jobId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  // fala a última resposta do gêmeo quando "ouvir" está ligado
  function speakText(text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      const vs = synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("pt"));
      if (vs[0]) u.voice = vs[0];
      synth.speak(u);
    } catch {
      /* navegador sem síntese: silencioso */
    }
  }

  async function sendText(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { from: "you", text: t }]);
    setBusy(true);
    try {
      const r = await twinTalk(jobId, t);
      setMsgs((m) => [...m, { from: "twin", text: r.message }]);
      if (speak) speakText(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const text = await transcribeVoice(blob);
          if (text) await sendText(text);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não consegui transcrever.");
        } finally {
          setTranscribing(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError(
        "Não consegui acessar o microfone. Autorize o microfone no navegador e tente de novo."
      );
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  if (ready.status !== "ready") {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-5"
        role="status"
        aria-live="polite"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-soul" />
        <p className="text-sm text-muted">
          {ready.status === "error"
            ? `Algo falhou ao preparar a essência: ${ready.detail ?? "erro"}`
            : "A essência está sendo preparada — as memórias estão sendo tecidas. Leva só um instante."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {(ready.memories ?? 0).toLocaleString("pt-BR")} memórias sustentam esta conversa.
        </p>
        <button
          onClick={() => {
            setSpeak((s) => !s);
            if (speak) window.speechSynthesis?.cancel();
          }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
            speak ? "border-soul text-soul" : "border-line text-muted hover:text-ink"
          }`}
          title="Ouvir as respostas em voz"
        >
          <SpeakerIcon on={speak} /> {speak ? "Voz ligada" : "Ouvir"}
        </button>
      </div>

      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
            Pergunte o que quiser — sobre a vida, sobre o que {quem} pensa, sobre o
            que deixaria dito. Escreva, ou toque no microfone e fale.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-2xl p-4 text-[15px] leading-relaxed ${
              m.from === "you"
                ? "ml-auto bg-soul/15 text-ink"
                : "border border-line bg-surface text-ink/90"
            }`}
          >
            {m.from === "twin" && (
              <p className="mb-1 text-xs uppercase tracking-wide text-soul">{quem}</p>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}
        {(busy || transcribing) && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
            {transcribing ? "Ouvindo o que você disse…" : `${quem} está pensando…`}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={busy || transcribing}
          title={recording ? "Parar e enviar" : "Falar"}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition disabled:opacity-40 ${
            recording
              ? "animate-pulse border-soul bg-soul text-[#241703]"
              : "border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          <MicIcon />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText(input)}
          placeholder={recording ? "Ouvindo…" : `Escreva para ${quem}…`}
          disabled={recording}
          className="flex-1 rounded-full border border-line bg-surface px-5 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={() => sendText(input)}
          disabled={busy || transcribing || !input.trim()}
          className="shrink-0 rounded-full bg-soul px-5 py-3 font-medium text-[#241703] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
      {recording && (
        <p className="mt-2 text-center text-xs text-soul">
          Gravando… toque no microfone de novo para enviar.
        </p>
      )}
    </div>
  );
}

/* ======================= ÁLBUM ======================= */

function Album({ jobId, name }: { jobId: string; name: string }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Piece | null>(null);

  useEffect(() => {
    fetchPieces(jobId)
      .then(setPieces)
      .finally(() => setLoading(false));
  }, [jobId]);

  const images = pieces.filter((p) => p.kind === "imagem");
  const others = pieces.filter((p) => p.kind !== "imagem");

  if (loading) return <p className="text-sm text-muted">Abrindo o álbum…</p>;

  if (pieces.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
        O álbum ainda está vazio.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-6 text-center text-[15px] leading-relaxed text-muted">
        O que {name || "esta pessoa"} guardou — e as palavras de quem guardou.
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="group overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-soul/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pieceImageUrl(jobId, p.id)}
                alt={p.title}
                className="aspect-square w-full object-cover"
              />
              <p className="px-3 py-2 text-sm text-ink">{p.title}</p>
            </button>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-10">
          <p className="text-sm text-muted">Escritos e gravações</p>
          <div className="mt-3 space-y-2">
            {others.map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-soul">
                    {p.kind}
                  </span>
                  <span className="text-ink">{p.title}</span>
                </div>
                {p.narration && (
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.narration}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pieceImageUrl(jobId, open.id)}
              alt={open.title}
              className="w-full rounded-xl"
            />
            <h2 className="mt-4 font-display text-2xl text-ink">{open.title}</h2>
            {open.narration ? (
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">
                {open.narration}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Esta peça não tem palavras ainda.</p>
            )}
            <button
              onClick={() => setOpen(null)}
              className="mt-5 rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ink"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= ícones ======================= */

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {on && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
      {on && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
      {!on && <line x1="23" y1="9" x2="17" y2="15" />}
      {!on && <line x1="17" y1="9" x2="23" y2="15" />}
    </svg>
  );
}
