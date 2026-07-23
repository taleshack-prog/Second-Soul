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
} from "@/lib/api";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const PII_OPTIONS = [
  { id: "strict", label: "Rigoroso", hint: "Recomendado",
    desc: "Remove CPF, cartões, telefones, e-mails e senhas." },
  { id: "balanced", label: "Equilibrado", hint: "",
    desc: "Remove CPF, cartões e senhas. Mantém contatos." },
  { id: "minimal", label: "Mínimo", hint: "",
    desc: "Remove só senhas e cartões." },
];

const STEPS = [
  { n: "01", title: "Preparar o acervo" },
  { n: "02", title: "Enviar as conversas" },
  { n: "03", title: "Conferir o acervo" },
  { n: "04", title: "Separar as vozes" },
  { n: "05", title: "Perfil da pessoa" },
];

export default function OnboardingWizard({
  resumeJobId,
}: {
  resumeJobId?: string;
} = {}) {
  const [step, setStep] = useState<Step>(resumeJobId ? 0 : 1);
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

  // retomada pelo link: abre no passo em que a pessoa parou
  useEffect(() => {
    if (!resumeJobId) return;
    fetchSession(resumeJobId)
      .then((st) => {
        setJobId(st.job_id);
        if (st.person_name) setPersonName(st.person_name);
        setStep((st.step as Step) ?? 2);
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
      const id = await startImport(slim, pii);
      setJobId(id);
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
            const active = step === i + 1;
            const done = step > i + 1;
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
        {resumeError && step === 1 && (
          <p className="mb-6 rounded-xl border border-soul/40 bg-soul/10 p-4 text-sm text-ink">
            {resumeError}
          </p>
        )}
        {step === 1 && <StepPrepare onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepUpload
            file={file} dragging={dragging} pii={pii} loading={loading}
            error={error} stages={stages} job={job} prep={prep} inputRef={inputRef}
            onPickClick={() => inputRef.current?.click()}
            onFile={setFile} onDrop={onDrop} setDragging={setDragging}
            setPii={setPii} onRead={handleRead} onBack={() => setStep(1)}
          />
        )}
        {step === 3 && result && (
          <StepReview result={result} onNext={() => setStep(4)} onAgain={reset} />
        )}
        {step === 4 && jobId && (
          <StepVoices
            jobId={jobId}
            personName={personName}
            setPersonName={setPersonName}
            onSaved={() => setStep(5)}
          />
        )}
        {step === 5 && jobId && (
          <StepProfile jobId={jobId} personName={personName}
            onSaved={() => setStep(6)} />
        )}
        {step === 6 && <StepDone personName={personName} jobId={jobId} />}
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

function StepProfile({ jobId, personName, onSaved }: {
  jobId: string; personName: string; onSaved: () => void;
}) {
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileFields().then(setFields).catch(() => setFields([]));
  }, []);

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
      <Eyebrow>Com as palavras dela</Eyebrow>
      <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink">
        Como {personName || "a pessoa"} se descreve?
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        As conversas mostram como a pessoa é sem querer. Aqui é o contrário: ela
        declara, com intenção, o que quer que fique. Preencha junto com ela —
        só o que ela quiser. Todos os campos são opcionais, e o que ela
        declarar pesa mais que tudo na essência.
      </p>

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
            ? `Salvar perfil (${filled} campo${filled > 1 ? "s" : ""})`
            : "Pular por enquanto"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Passo 6: conversar com a essência ---------------- */

type Msg = { from: "you" | "twin"; text: string };

function StepDone({ personName, jobId }: { personName: string; jobId: string | null }) {
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
            esta conversa.
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
