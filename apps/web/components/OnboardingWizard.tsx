"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchStages,
  startImport,
  pollUntilDone,
  fetchThemes,
  previewVoice,
  saveVoice,
  fetchProfileFields,
  saveProfile,
  type ImportResult,
  type JobStatus,
  type Stage,
  type Theme,
  type VoicePreview,
  type ProfileField,
  twinReady,
  twinTalk,
  type TwinReady,
  fetchSession,
  extractConversations,
  fetchProfile,
  addTextMemory,
  addFileMemory,
  fetchPieces,
  type Piece,
  newSession,
  pieceImageUrl,
  getConsent,
  acceptConsent,
  exportUrl,
  deleteSession,
} from "@/lib/api";

type Step = number;

const PII_OPTIONS = [
  { id: "strict", label: "Rigoroso", hint: "Recomendado",
    desc: "Remove CPF, cartões, telefones, e-mails e senhas." },
  { id: "balanced", label: "Equilibrado", hint: "",
    desc: "Remove CPF, cartões e senhas. Mantém contatos." },
  { id: "minimal", label: "Mínimo", hint: "",
    desc: "Remove só senhas e cartões." },
];

const STEPS = [
  { n: "01", title: "Quem é você" },
  { n: "02", title: "O seu acervo" },
  { n: "03", title: "Conversar" },
];

// passos do fluxo principal
const PERFIL = 1, ACERVO = 2, CONVERSA = 3;
const ALBUM = 4;
const CONSENTIMENTO = 0.5;
// sub-fluxo opcional: importar conversas de IA
const IMP_ENVIAR = 10, IMP_CONFERIR = 11, IMP_VOZES = 12;

export default function OnboardingWizard({
  resumeJobId,
}: {
  resumeJobId?: string;
} = {}) {
  const [step, setStep] = useState<Step>(0);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [prep, setPrep] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pii, setPii] = useState("strict");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStages().then(setStages).catch(() => setStages([]));
  }, []);

  // a jornada começa por QUEM a pessoa é: a essência nasce aqui, sem arquivo
  useEffect(() => {
    if (resumeJobId || jobId) return;
    newSession()
      .then(async (id) => {
        setJobId(id);
        setStep((await getConsent(id)) ? PERFIL : CONSENTIMENTO);
      })
      .catch(() => setResumeError("Não conseguimos iniciar. Tente recarregar."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeJobId]);

  // retomada pelo link: abre no passo em que a pessoa parou
  useEffect(() => {
    if (!resumeJobId) return;
    fetchSession(resumeJobId)
      .then(async (st) => {
        setJobId(st.job_id);
        if (st.person_name) setPersonName(st.person_name);
        const ok = await getConsent(st.job_id);
        const known = [PERFIL, ACERVO, CONVERSA];
        const target = known.includes(st.step) ? st.step : ACERVO;
        setStep(ok ? target : CONSENTIMENTO);
      })
      .catch((e) => {
        setResumeError(e instanceof Error ? e.message : "Link não encontrado.");
        setStep(1);
      });
  }, [resumeJobId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  async function handleRead() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setJob(null);
    try {
      const slim = await extractConversations(file, setPrep);
      setPrep(null);
      const id = await startImport(slim, pii, jobId ?? undefined);
      const r = await pollUntilDone(id, setJob);
      setResult(r);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setLoading(false);
      setPrep(null);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setJob(null);
    setJobId(null);
    setStep(2);
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-12 px-6 py-14 md:grid-cols-[220px_1fr] md:py-24">
      <aside className="md:pt-2">
        <div className="mb-10 flex items-center gap-2.5">
          <Flame />
          <span className="font-display text-lg tracking-tight text-ink">
            Second Soul
          </span>
        </div>
        <ol className="space-y-4">
          {STEPS.map((s, i) => {
            const main = step >= 10 ? ACERVO : step;
            const active = main === i + 1;
            const done = main > i + 1;
            return (
              <li key={s.n} className="flex items-start gap-3">
                <span className={`mt-0.5 font-display text-sm ${
                  active ? "text-soul" : done ? "text-muted" : "text-line"
                }`}>{s.n}</span>
                <span className={`text-sm leading-tight ${
                  active ? "text-ink" : "text-muted"
                }`}>{s.title}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="max-w-xl">
        {jobId && step >= 3 && <ReturnLink jobId={jobId} />}
        {step === 0 && (
          <div className="flex items-center gap-3 text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-soul" />
            Abrindo sua essência…
          </div>
        )}
        {resumeError && (
          <p className="mb-6 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
            {resumeError}
          </p>
        )}

        {step === CONSENTIMENTO && jobId && (
          <StepConsent jobId={jobId} onAccept={() => setStep(PERFIL)} />
        )}

        {step === PERFIL && jobId && (
          <StepProfile jobId={jobId} personName={personName}
            setPersonName={setPersonName}
            onSaved={() => setStep(ACERVO)} />
        )}

        {step === ACERVO && jobId && (
          <StepMemories jobId={jobId} personName={personName}
            onImport={() => setStep(IMP_ENVIAR)}
            onDone={() => setStep(CONVERSA)}
            onAlbum={() => setStep(ALBUM)} />
        )}

        {step === CONVERSA && (
          <StepDone personName={personName} jobId={jobId}
            onEditProfile={() => setStep(PERFIL)}
            onAddMemories={() => setStep(ACERVO)} />
        )}

        {step === ALBUM && jobId && (
          <StepAlbum jobId={jobId} personName={personName}
            onBack={() => setStep(ACERVO)} />
        )}

        {step === IMP_ENVIAR && (
          <StepUpload
            file={file} dragging={dragging} pii={pii} loading={loading}
            error={error} stages={stages} job={job} prep={prep} inputRef={inputRef}
            onPickClick={() => inputRef.current?.click()}
            onFile={setFile} onDrop={onDrop} setDragging={setDragging}
            setPii={setPii} onRead={handleRead} onBack={() => setStep(ACERVO)}
          />
        )}
        {step === IMP_CONFERIR && result && (
          <StepReview result={result} onNext={() => setStep(IMP_VOZES)}
            onAgain={() => { setFile(null); setResult(null); setStep(IMP_ENVIAR); }} />
        )}
        {step === IMP_VOZES && jobId && (
          <StepVoices jobId={jobId} personName={personName}
            setPersonName={setPersonName}
            onSaved={() => setStep(ACERVO)} />
        )}
      </section>
    </main>
  );
}

/* ---------------- Passo 1 ---------------- */

function StepPrepare({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <Eyebrow>Um acervo de conversas</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink md:text-5xl">
        Comece pelas conversas que ela já teve.
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        Anos de conversas com o ChatGPT guardam o jeito de pensar, os valores e a
        voz de uma pessoa. Traga esse acervo e a essência começa a tomar forma —
        sem começar do zero.
      </p>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg text-ink">Como obter o arquivo</h2>
        <ol className="mt-4 space-y-3 text-[15px] text-muted">
          <Instruction n={1}>
            Na conta do ChatGPT, abra{" "}
            <a className="text-soul underline underline-offset-4"
              href="https://chatgpt.com/#settings/DataControls"
              target="_blank" rel="noopener noreferrer">
              Configurações › Controles de dados
            </a>.
          </Instruction>
          <Instruction n={2}>
            Em <b className="text-ink">Exportar dados</b>, toque em{" "}
            <b className="text-ink">Exportar</b> e confirme.
          </Instruction>
          <Instruction n={3}>
            Chega um e-mail com um link. Ele vale por 24 horas — baixe o{" "}
            <b className="text-ink">.zip</b> assim que chegar.
          </Instruction>
        </ol>
        <p className="mt-4 text-sm text-muted/80">
          Vai ajudar alguém idoso? Faça esses passos por ela, logado na conta
          dela. É o jeito mais simples.
        </p>
      </div>
      <button onClick={onNext}
        className="mt-8 rounded-full bg-soul px-6 py-3 font-medium text-base text-[#241703] transition-transform hover:-translate-y-0.5">
        Já tenho o arquivo
      </button>
    </div>
  );
}

/* ---------------- Passo 2 ---------------- */

function StepUpload(props: {
  file: File | null; dragging: boolean; pii: string; loading: boolean;
  error: string | null; stages: Stage[]; job: JobStatus | null;
  prep: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onPickClick: () => void; onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void; setDragging: (b: boolean) => void;
  setPii: (s: string) => void; onRead: () => void; onBack: () => void;
}) {
  const { file, dragging, pii, loading, error, stages, job, prep, inputRef,
    onPickClick, onFile, onDrop, setDragging, setPii, onRead, onBack } = props;

  return (
    <div>
      <Eyebrow>O acervo</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        Deixe as conversas entrarem.
      </h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop} onClick={onPickClick} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPickClick()}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border px-6 py-12 text-center transition-all ${
          dragging ? "border-soul bg-surface2 shadow-vessel"
          : file ? "border-soul/50 bg-surface"
          : "border-dashed border-line bg-surface hover:border-soul/40"
        }`}
      >
        <div className={`grid h-14 w-14 place-items-center rounded-full transition-all ${
          file || dragging ? "bg-soul/20" : "bg-surface2"
        }`}>
          <Flame lit={file !== null || dragging} />
        </div>
        {file ? (
          <p className="mt-4 text-ink"><span className="font-medium">{file.name}</span></p>
        ) : (
          <>
            <p className="mt-4 text-ink">Arraste o arquivo aqui</p>
            <p className="mt-1 text-sm text-muted">
              ou toque para escolher — .zip ou conversations.json
            </p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".zip,.json" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm text-muted">O que proteger antes de guardar</legend>
        <div className="mt-3 space-y-2.5">
          {PII_OPTIONS.map((o) => {
            const on = pii === o.id;
            return (
              <label key={o.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  on ? "border-soul bg-surface2" : "border-line bg-surface"
                }`}>
                <input type="radio" name="pii" value={o.id} checked={on}
                  onChange={() => setPii(o.id)} className="sr-only" />
                <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  on ? "border-soul bg-soul" : "border-muted"
                }`} />
                <span>
                  <span className="text-ink">
                    {o.label}
                    {o.hint && <span className="ml-2 text-xs text-soul">{o.hint}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{o.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {loading && prep && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-5"
          role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-soul" />
          <p className="text-sm text-muted">
            {prep} <span className="text-muted/70">Isso acontece no seu aparelho — nada foi enviado ainda.</span>
          </p>
        </div>
      )}
      {loading && !prep && <ImportProgress stages={stages} job={job} />}

      {error && (
        <p className="mt-5 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button onClick={onRead} disabled={!file || loading}
          className="rounded-full bg-soul px-6 py-3 font-medium text-base text-[#241703] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">
          {loading ? "Lendo as conversas…" : "Ler as conversas"}
        </button>
        <button onClick={onBack} className="text-sm text-muted hover:text-ink">
          Voltar
        </button>
      </div>
    </div>
  );
}

/* ---------------- Passo 3 ---------------- */

function StepReview({ result, onNext, onAgain }: {
  result: ImportResult; onNext: () => void; onAgain: () => void;
}) {
  const fromPerson = result.by_role["user"] ?? 0;
  return (
    <div>
      <Eyebrow>O acervo</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        {result.clean_count.toLocaleString("pt-BR")} mensagens guardadas.
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        Lemos o acervo e guardamos {result.clean_count.toLocaleString("pt-BR")}{" "}
        mensagens
        {fromPerson > 0 && (
          <> — {fromPerson.toLocaleString("pt-BR")} escritas por quem usou a conta</>
        )}.{" "}
        {result.scrubbed_count > 0
          ? `Protegemos ${result.scrubbed_count} com dados sensíveis antes de guardar.`
          : "Nenhum dado sensível precisou ser removido."}
      </p>
      <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        Uma conta costuma ter mais de uma pessoa — família compartilha login. O
        próximo passo é separar as vozes e escolher de quem é a essência que
        você quer preservar.
      </p>
      <div className="mt-8 space-y-3">
        {result.preview.map((p, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">
                {p.role === "user" ? "escrito na conta"
                  : p.role === "assistant" ? "resposta da IA" : p.role}
              </span>
              {p.pii_scrubbed && (
                <span className="rounded-full bg-soul/15 px-2 py-0.5 text-xs text-soul">
                  protegido
                </span>
              )}
            </div>
            <p className="text-[15px] leading-relaxed text-ink/90">
              {p.content}{p.content.length >= 400 && "…"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-4">
        <button onClick={onNext}
          className="rounded-full bg-soul px-6 py-3 font-medium text-base text-[#241703] transition-transform hover:-translate-y-0.5">
          Separar as vozes
        </button>
        <button onClick={onAgain} className="text-sm text-muted hover:text-ink">
          Enviar outro arquivo
        </button>
      </div>
    </div>
  );
}

/* ---------------- Passo 4: separar as vozes ---------------- */

function StepVoices({ jobId, personName, setPersonName, onSaved }: {
  jobId: string; personName: string;
  setPersonName: (s: string) => void; onSaved: () => void;
}) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [threshold, setThreshold] = useState(0.03);
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes(jobId).then(setThemes).catch(() => setThemes([]));
  }, [jobId]);

  const allTerms = [
    ...selected,
    ...extra.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean),
  ];

  useEffect(() => {
    if (allTerms.length === 0) { setPreview(null); return; }
    const h = setTimeout(() => {
      previewVoice(jobId, allTerms, threshold)
        .then((p) => { setPreview(p); setError(null); })
        .catch((e) => setError(e.message));
    }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, selected.join(","), extra, threshold]);

  function toggle(term: string) {
    setSelected((s) =>
      s.includes(term) ? s.filter((t) => t !== term) : [...s, term]
    );
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await saveVoice(jobId, allTerms, threshold, personName || "a pessoa");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Eyebrow>As vozes</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        De quem é a essência?
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        Estes são os temas que encontramos no acervo. Marque os que pertencem à
        pessoa que você quer preservar — o restante fica de fora.
      </p>

      <div className="mt-6">
        <label className="text-sm text-muted">Quem é essa pessoa?</label>
        <input value={personName} onChange={(e) => setPersonName(e.target.value)}
          placeholder="ex.: minha mãe"
          className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none" />
      </div>

      {themes.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-muted">Temas encontrados no acervo:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {themes.map((t) => {
              const on = selected.includes(t.term);
              return (
                <button key={t.term} onClick={() => toggle(t.term)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    on ? "border-soul bg-soul/15 text-soul"
                    : "border-line bg-surface text-muted hover:border-soul/40 hover:text-ink"
                  }`}>
                  {t.term}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        <label className="text-sm text-muted">
          Outros temas dela (separe por vírgula):
        </label>
        <input value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder="ex.: conscienciologia, estado vibracional, tenepes"
          className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none" />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted">Termômetro de semelhança</label>
          <span className="text-sm text-soul">
            {threshold <= 0.02 ? "mais abrangente" : threshold >= 0.08 ? "mais rigoroso" : "equilibrado"}
          </span>
        </div>
        <input type="range" min={0.02} max={0.12} step={0.01} value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="mt-2 w-full accent-[#E8B060]" />
      </div>

      {preview && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5" aria-live="polite">
          <p className="text-ink">
            <span className="font-display text-2xl text-soul">
              {preview.kept.toLocaleString("pt-BR")}
            </span>{" "}
            <span className="text-muted">
              de {preview.total.toLocaleString("pt-BR")} mensagens são dela com
              esses temas.
            </span>
          </p>
          {preview.samples.length > 0 && (
            <div className="mt-4 space-y-2">
              {preview.samples.slice(0, 3).map((s, i) => (
                <p key={i} className="rounded-xl bg-surface2 p-3 text-sm leading-relaxed text-ink/85">
                  {s}…
                </p>
              ))}
            </div>
          )}
          {preview.borderline.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted hover:text-ink">
                Quase entraram (abaixe o termômetro se forem dela)
              </summary>
              <div className="mt-2 space-y-1.5">
                {preview.borderline.map((b, i) => (
                  <p key={i} className="text-sm text-muted">· {b}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {error && (
        <p className="mt-5 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button onClick={handleSave}
          disabled={busy || !preview || preview.kept === 0}
          className="rounded-full bg-soul px-6 py-3 font-medium text-base text-[#241703] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Guardando…" : "Guardar a essência"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Passo 5: perfil ---------------- */

function StepProfile({ jobId, personName, setPersonName, onSaved }: {
  jobId: string; personName: string;
  setPersonName: (s: string) => void; onSaved: () => void;
}) {
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchProfileFields().then(setFields).catch(() => setFields([]));
  }, []);

  // carrega o que já foi declarado — o formulário abria em branco mesmo
  // com o perfil salvo, o que parecia perda de dados.
  useEffect(() => {
    fetchProfile(jobId)
      .then((p) => {
        if (p?.fields) setValues(p.fields);
      })
      .finally(() => setLoaded(true));
  }, [jobId]);

  const filled = Object.values(values).filter((v) => v.trim()).length;

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await saveProfile(jobId, personName || "a pessoa", values);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Eyebrow>Comece por você</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        Quem é a pessoa que ficará guardada aqui?
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        As conversas mostram como a pessoa é sem querer. Aqui é o contrário: ela
        declara, com intenção, o que quer que fique. Preencha junto com ela —
        só o que ela quiser. Todos os campos são opcionais, e o que ela
        declarar pesa mais que tudo na essência.
      </p>

      {loaded && filled > 0 && (
        <p className="mt-6 rounded-xl border border-soul/30 bg-soul/5 p-4 text-sm text-ink">
          Retomamos o que já estava declarado. Edite o que quiser e salve de novo.
        </p>
      )}

      <div className="mt-7">
        <label className="text-ink">Nome</label>
        <input value={personName} onChange={(e) => setPersonName(e.target.value)}
          placeholder="Como quer ser chamada nesta essência"
          className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none" />
      </div>

      <div className="mt-8 space-y-6">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-ink">{f.label}</label>
            <p className="mt-0.5 text-sm text-muted">{f.prompt}</p>
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              rows={f.key === "pensamentos" ? 6 : 3}
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted/50 focus:border-soul focus:outline-none"
              placeholder="Escreva com as palavras dela — ou deixe em branco."
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-5 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button onClick={handleSave} disabled={busy}
          className="rounded-full bg-soul px-6 py-3 font-medium text-base text-[#241703] transition-transform hover:-translate-y-0.5 disabled:opacity-40">
          {busy ? "Salvando…" : filled > 0
            ? `Continuar (${filled} campo${filled > 1 ? "s" : ""} preenchido${filled > 1 ? "s" : ""})`
            : "Continuar sem preencher"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Passo 6: conversar com a essência ---------------- */

type Msg = { from: "you" | "twin"; text: string };

function StepDone({
  personName,
  jobId,
  onEditProfile,
  onAddMemories,
}: {
  personName: string;
  jobId: string | null;
  onEditProfile: () => void;
  onAddMemories: () => void;
}) {
  const [ready, setReady] = useState<TwinReady>({ status: "building" });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const tick = async () => {
      const r = await twinReady(jobId);
      if (!alive) return;
      setReady(r);
      if (r.status === "building" || r.status === "missing") {
        setTimeout(tick, 1200);
      }
    };
    tick();
    return () => { alive = false; };
  }, [jobId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || !jobId || busy) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { from: "you", text }]);
    setBusy(true);
    try {
      const r = await twinTalk(jobId, text);
      setMsgs((m) => [...m, { from: "twin", text: r.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  const name = personName || "a pessoa";

  return (
    <div>
      <Eyebrow>A essência</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        Converse com {name}.
      </h1>

      {ready.status !== "ready" && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-5"
          role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-soul" />
          <p className="text-sm text-muted">
            {ready.status === "error"
              ? `Algo falhou ao preparar a essência: ${ready.detail ?? "erro"}`
              : "A essência está sendo preparada — as memórias estão sendo tecidas. Leva só um instante."}
          </p>
        </div>
      )}

      {ready.status === "ready" && (
        <>
          <p className="mt-4 text-sm text-muted">
            {(ready.memories ?? 0).toLocaleString("pt-BR")} memórias sustentam
            esta conversa.{" "}
            <button onClick={onEditProfile}
              className="text-soul underline underline-offset-4 hover:opacity-80">
              Revisar o perfil
            </button>
            {" · "}
            <button onClick={onAddMemories}
              className="text-soul underline underline-offset-4 hover:opacity-80">
              Acrescentar memórias
            </button>
          </p>
          {jobId && <DataRights jobId={jobId} />}
          <p className="hidden">
          </p>

          <div className="mt-6 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {msgs.length === 0 && (
              <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
                Pergunte o que quiser — sobre a vida, sobre o que ela pensa,
                sobre o que ela deixaria dito.
              </p>
            )}
            {msgs.map((m, i) => (
              <div key={i}
                className={`max-w-[92%] rounded-2xl p-4 text-[15px] leading-relaxed ${
                  m.from === "you"
                    ? "ml-auto bg-soul/15 text-ink"
                    : "border border-line bg-surface text-ink/90"
                }`}>
                {m.from === "twin" && (
                  <p className="mb-1 text-xs uppercase tracking-wide text-soul">{name}</p>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
                {name} está pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Escreva para ${name}…`}
              className="flex-1 rounded-full border border-line bg-surface px-5 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none"
            />
            <button onClick={send} disabled={busy || !input.trim()}
              className="rounded-full bg-soul px-6 py-3 font-medium text-[#241703] transition-transform hover:-translate-y-0.5 disabled:opacity-40">
              Enviar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Passo 7: acrescentar memórias ---------------- */

function StepMemories({
  jobId,
  personName,
  onImport,
  onDone,
  onAlbum,
}: {
  jobId: string;
  personName: string;
  onImport: () => void;
  onDone: () => void;
  onAlbum: () => void;
}) {
  const [mode, setMode] = useState<"escrever" | "arquivo">("escrever");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPieces(jobId).then(setPieces).catch(() => setPieces([]));
  }, [jobId]);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (mode === "escrever") {
        const r = await addTextMemory(jobId, title, content);
        setMsg(`Guardado: ${r.title} (${r.words} palavras).`);
        setTitle("");
        setContent("");
      } else {
        if (!file) return;
        const r = await addFileMemory(jobId, file, title, narration);
        setMsg(
          r.transcript
            ? `Transcrito e guardado: ${r.title}.`
            : `Guardado: ${r.title}.`
        );
        setFile(null);
        setTitle("");
        setNarration("");
        if (fileRef.current) fileRef.current.value = "";
      }
      setPieces(await fetchPieces(jobId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  const isImage = file ? /\.(jpe?g|png|heic|webp|gif|tiff)$/i.test(file.name) : false;

  return (
    <div>
      <Eyebrow>O acervo</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        O que mais {personName || "você"} quer deixar guardado?
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        Uma crônica, uma história de família, uma decisão difícil, uma foto de
        algo que você criou. O que for escrito ou narrado passa a fazer parte da
        essência; imagens ficam no acervo com as suas palavras ao lado.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink">
          <b>Já conversa com alguma IA?</b> Anos de conversas guardam jeito de
          pensar e valores. Dá para trazer esse acervo de uma vez.
        </p>
        <button onClick={onImport}
          className="mt-3 rounded-full border border-soul/50 px-4 py-1.5 text-sm text-soul transition-colors hover:bg-soul/10">
          Importar conversas do ChatGPT
        </button>
      </div>

      <div className="mt-7 flex gap-2">
        {(["escrever", "arquivo"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              mode === m
                ? "border-soul bg-soul/15 text-soul"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}>
            {m === "escrever" ? "Escrever agora" : "Enviar arquivo"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Um título — ex.: O bonsai do meu pai"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-soul focus:outline-none" />

        {mode === "escrever" ? (
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            rows={10} placeholder="Conte com as suas palavras…"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted/50 focus:border-soul focus:outline-none" />
        ) : (
          <>
            <div onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              className={`cursor-pointer rounded-2xl border px-6 py-8 text-center transition-colors ${
                file ? "border-soul/50 bg-surface" : "border-dashed border-line bg-surface hover:border-soul/40"
              }`}>
              <p className="text-ink">{file ? file.name : "Escolher arquivo"}</p>
              <p className="mt-1 text-sm text-muted">
                texto, áudio, vídeo ou imagem — áudio e vídeo até 25 MB
              </p>
              <input ref={fileRef} type="file" className="hidden"
                accept=".txt,.md,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.jpg,.jpeg,.png,.heic,.webp"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
            </div>
            {isImage && (
              <textarea value={narration} onChange={(e) => setNarration(e.target.value)}
                rows={4}
                placeholder="Conte sobre esta imagem — é isso que a essência vai guardar."
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted/50 focus:border-soul focus:outline-none" />
            )}
          </>
        )}
      </div>

      {msg && (
        <p className="mt-4 rounded-xl border border-soul/30 bg-soul/5 p-4 text-sm text-ink">
          {msg}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-7 flex items-center gap-4">
        <button onClick={save}
          disabled={busy || (mode === "escrever" ? content.trim().length < 10 : !file)}
          className="rounded-full bg-soul px-6 py-3 font-medium text-[#241703] transition-transform hover:-translate-y-0.5 disabled:opacity-40">
          {busy ? "Guardando…" : "Guardar no acervo"}
        </button>
        <button onClick={onDone} className="text-sm text-muted hover:text-ink">
          Conversar com a essência
        </button>
        <button onClick={onAlbum} className="text-sm text-muted hover:text-ink">
          Ver o álbum
        </button>
      </div>

      {pieces.length > 0 && (
        <div className="mt-10">
          <p className="text-sm text-muted">
            {pieces.length} peça{pieces.length > 1 ? "s" : ""} no acervo
          </p>
          <div className="mt-3 space-y-2">
            {pieces.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-soul">
                    {p.kind}
                  </span>
                  <span className="text-ink">{p.title}</span>
                </div>
                {p.narration && (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {p.narration.slice(0, 160)}
                    {p.narration.length > 160 && "…"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Consentimento ---------------- */

function StepConsent({
  jobId,
  onAccept,
}: {
  jobId: string;
  onAccept: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptConsent(jobId);
      onAccept();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Eyebrow>Antes de começar</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        O que você guardar aqui é seu.
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        Você está prestes a confiar memórias a este lugar. Antes disso, o que
        precisa saber — sem letra miúda.
      </p>

      <ul className="mt-8 space-y-4 text-[15px] leading-relaxed text-muted">
        <li className="rounded-xl border border-line bg-surface p-4">
          Suas memórias ficam em servidores nos <b className="text-ink">Estados
          Unidos</b>, e trechos delas são enviados a um provedor de IA para gerar
          as conversas.
        </li>
        <li className="rounded-xl border border-line bg-surface p-4">
          O <b className="text-ink">link do seu acervo é a chave</b> — não há
          senha ainda. Quem tiver o link entra.
        </li>
        <li className="rounded-xl border border-line bg-surface p-4">
          Você pode <b className="text-ink">levar tudo embora</b> ou{" "}
          <b className="text-ink">apagar para sempre</b>, quando quiser.
        </li>
        <li className="rounded-xl border border-line bg-surface p-4">
          Isto é uma <b className="text-ink">versão de testes</b>. Guarde os
          originais com você — não use como único lugar do que é insubstituível.
        </li>
      </ul>

      {error && (
        <p className="mt-5 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button onClick={accept} disabled={busy}
          className="rounded-full bg-soul px-6 py-3 font-medium text-[#241703] transition-transform hover:-translate-y-0.5 disabled:opacity-40">
          {busy ? "Registrando…" : "Entendi e quero começar"}
        </button>
        <a href="/privacidade" target="_blank" rel="noopener noreferrer"
          className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          Ler a página de privacidade
        </a>
      </div>
    </div>
  );
}

/* ---------------- direitos sobre os dados ---------------- */

function DataRights({ jobId }: { jobId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  async function remove() {
    try {
      await deleteSession(jobId);
      setDone(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch {
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-ink">
        Apagamos tudo. Não guardamos cópia.
      </p>
    );
  }

  return (
    <div className="mt-4 text-sm text-muted">
      <a href={exportUrl(jobId)}
        className="underline underline-offset-4 hover:text-ink">
        Levar meus dados
      </a>
      {" · "}
      {confirming ? (
        <span className="text-ink">
          Apagar tudo para sempre?{" "}
          <button onClick={remove} className="text-soul underline underline-offset-4">
            Sim, apagar
          </button>
          {" / "}
          <button onClick={() => setConfirming(false)} className="underline underline-offset-4">
            não
          </button>
        </span>
      ) : (
        <button onClick={() => setConfirming(true)}
          className="underline underline-offset-4 hover:text-ink">
          Apagar tudo
        </button>
      )}
      {" · "}
      <a href="/privacidade" target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-4 hover:text-ink">
        Privacidade
      </a>
    </div>
  );
}

/* ---------------- Álbum: o museu da pessoa ---------------- */

function StepAlbum({
  jobId,
  personName,
  onBack,
}: {
  jobId: string;
  personName: string;
  onBack: () => void;
}) {
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

  return (
    <div>
      <Eyebrow>O álbum</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        O acervo de {personName || "você"}.
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        O que ficou guardado — e as palavras de quem guardou. É isto que seus
        descendentes vão ver.
      </p>

      {loading && <p className="mt-8 text-sm text-muted">Abrindo o álbum…</p>}

      {!loading && pieces.length === 0 && (
        <p className="mt-8 rounded-2xl border border-line bg-surface p-6 text-muted">
          O álbum ainda está vazio. Volte ao acervo para guardar uma imagem, uma
          crônica ou uma gravação.
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)}
              className="group overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-soul/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pieceImageUrl(jobId, p.id)} alt={p.title}
                className="aspect-square w-full object-cover" />
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
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {p.narration.slice(0, 200)}
                    {p.narration.length > 200 && "…"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onBack}
        className="mt-10 text-sm text-muted hover:text-ink">
        Voltar ao acervo
      </button>

      {open && (
        <div onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pieceImageUrl(jobId, open.id)} alt={open.title}
              className="w-full rounded-xl" />
            <h2 className="mt-4 font-display text-2xl text-ink">{open.title}</h2>
            {open.narration ? (
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">
                {open.narration}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Esta peça ainda não tem as suas palavras.
              </p>
            )}
            <button onClick={() => setOpen(null)}
              className="mt-5 rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ink">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- link de retorno ---------------- */

function ReturnLink({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${jobId}`
      : `/s/${jobId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* alguns navegadores bloqueiam; o texto continua visível para copiar */
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-soul/30 bg-soul/5 p-5">
      <p className="text-sm text-ink">
        <b>Guarde este endereço.</b> É a chave para voltar a esta essência —
        em outro dia, em outro aparelho. Sem ele, não há como reencontrá-la.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="flex-1 overflow-x-auto rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
          {url}
        </code>
        <button
          onClick={copy}
          className="rounded-full border border-soul/50 px-4 py-1.5 text-sm text-soul transition-colors hover:bg-soul/10"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Envie para você mesmo por e-mail ou salve nos favoritos.
      </p>
    </div>
  );
}

/* ---------------- progresso (etapas reais) ---------------- */

function ImportProgress({ stages, job }: { stages: Stage[]; job: JobStatus | null }) {
  const list = stages.length ? stages : [
    { key: "detectando", label: "Reconhecendo o arquivo" },
    { key: "lendo", label: "Lendo as conversas" },
    { key: "limpando", label: "Removendo ruído" },
    { key: "deduplicando", label: "Removendo repetições" },
    { key: "protegendo", label: "Protegendo dados sensíveis" },
    { key: "concluido", label: "Pronto" },
  ];
  const currentIdx = job?.stage ? list.findIndex((s) => s.key === job.stage) : 0;
  const pct = Math.round(((Math.max(0, currentIdx) + 1) / list.length) * 100);
  const read = job?.stage_info?.raw_count as number | undefined;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-6"
      role="status" aria-live="polite">
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-soul transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2.5">
        {list.map((s, i) => {
          const isDone = i < currentIdx;
          const isNow = i === currentIdx;
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                isDone ? "border-soul bg-soul" : isNow ? "border-soul" : "border-line"
              }`}>
                {isDone && (
                  <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>
                    <path d="M1 5l3 3 5-6" fill="none" stroke="#241703"
                      strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {isNow && <span className="h-1.5 w-1.5 rounded-full bg-soul" />}
              </span>
              <span className={isDone || isNow ? "text-ink" : "text-muted"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        {read
          ? `${read.toLocaleString("pt-BR")} mensagens encontradas — pode deixar a página aberta.`
          : "Isso pode levar alguns minutos em acervos grandes. Pode deixar a página aberta."}
      </p>
    </div>
  );
}

/* ---------------- peças ---------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-[0.2em] text-soul">{children}</span>
  );
}

function Instruction({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[11px] text-muted">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function Flame({ lit = true }: { lit?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2c0 4-5 5-5 10a5 5 0 0 0 10 0c0-2-1-3.5-2-5 0 2-1.5 3-3 3 1.5-3 0-6 0-8z"
        fill={lit ? "#E8B060" : "#3A4067"} />
    </svg>
  );
}
