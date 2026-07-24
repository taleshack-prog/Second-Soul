export type PreviewItem = {
  role: string | null;
  source: string;
  content: string;
  pii_scrubbed: boolean;
  classification: string;
};

export type ImportResult = {
  status: string;
  platform: string;
  file: string;
  raw_count: number;
  clean_count: number;
  scrubbed_count: number;
  by_role: Record<string, number>;
  preview: PreviewItem[];
};

export type JobStatus = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  stage: string | null;
  stage_info: Record<string, unknown>;
  file: string;
  result: ImportResult | null;
  error: string | null;
};

export type Stage = { key: string; label: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

async function fail(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const body = await res.json();
    if (body?.detail) detail = body.detail;
  } catch {
    /* mantém a mensagem padrão */
  }
  throw new Error(detail);
}

export async function fetchStages(): Promise<Stage[]> {
  const res = await fetch(`${API}/api/v1/import/stages`);
  if (!res.ok) return [];
  return (await res.json()).stages ?? [];
}

/** Envia o arquivo; responde na hora com o id da tarefa. */
export async function newSession(): Promise<string> {
  const res = await fetch(`${API}/api/v1/session/new`, { method: "POST" });
  if (!res.ok) await fail(res, "Não foi possível iniciar.");
  return (await res.json()).job_id;
}

/** Envia o arquivo; responde na hora com o id da tarefa. */
export async function startImport(
  file: File,
  piiLevel: string,
  jobId?: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("pii_level", piiLevel);
  if (jobId) form.append("job_id", jobId);

  const res = await fetch(`${API}/api/v1/import/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await fail(res, "Não foi possível enviar esse arquivo.");
  return (await res.json()).job_id;
}

export async function getStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API}/api/v1/import/status/${jobId}`);
  if (!res.ok) await fail(res, "Perdemos o acompanhamento dessa importação.");
  return res.json();
}

/** Acompanha até terminar, avisando a cada mudança de etapa. */
export async function pollUntilDone(
  jobId: string,
  onStage: (s: JobStatus) => void,
  intervalMs = 700,
  timeoutMs = 15 * 60 * 1000
): Promise<ImportResult> {
  const started = Date.now();
  for (;;) {
    const s = await getStatus(jobId);
    onStage(s);
    if (s.status === "done" && s.result) return s.result;
    if (s.status === "error") throw new Error(s.error ?? "Falha ao processar.");
    if (Date.now() - started > timeoutMs) {
      throw new Error("A importação demorou mais que o esperado.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}


/* ---------- extração no navegador ---------- */

/**
 * O export do ChatGPT traz TUDO: imagens geradas, áudios, anexos — centenas de
 * MB que o pipeline descarta. Só os conversations*.json interessam.
 *
 * Extraímos no próprio navegador e enviamos apenas o essencial. Um export de
 * 315 MB vira poucos MB: o envio deixa de estourar tempo e de gastar a internet
 * de quem está do outro lado.
 */
export async function extractConversations(
  file: File,
  onProgress?: (msg: string) => void
): Promise<File> {
  if (!file.name.toLowerCase().endsWith(".zip")) return file;

  const JSZip = (await import("jszip")).default;
  onProgress?.("Abrindo o arquivo…");
  const zip = await JSZip.loadAsync(file);

  const wanted = Object.keys(zip.files).filter(
    (n) => /conversations.*\.json$/i.test(n) && !zip.files[n].dir
  );
  if (wanted.length === 0) return file; // deixa a API diagnosticar

  onProgress?.("Separando as conversas…");
  const out = new JSZip();
  for (const name of wanted) {
    const content = await zip.files[name].async("uint8array");
    out.file(name.split("/").pop() || name, content);
  }

  onProgress?.("Preparando o envio…");
  const blob = await out.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return new File([blob], "conversas.zip", { type: "application/zip" });
}

/* ---------- separação de vozes ---------- */

export type Theme = { term: string; messages: number };
export type VoicePreview = {
  total: number;
  kept: number;
  threshold: number;
  grid: Record<string, number>;
  samples: string[];
  borderline: string[];
};

export async function fetchThemes(jobId: string): Promise<Theme[]> {
  const res = await fetch(`${API}/api/v1/voices/themes/${jobId}`);
  if (!res.ok) await fail(res, "Não conseguimos analisar o acervo.");
  return (await res.json()).themes ?? [];
}

export async function previewVoice(
  jobId: string,
  terms: string[],
  threshold: number
): Promise<VoicePreview> {
  const res = await fetch(`${API}/api/v1/voices/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, terms, threshold }),
  });
  if (!res.ok) await fail(res, "Não foi possível filtrar com esses termos.");
  return res.json();
}

export async function saveVoice(
  jobId: string,
  terms: string[],
  threshold: number,
  personName: string
): Promise<number> {
  const res = await fetch(`${API}/api/v1/voices/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      terms,
      threshold,
      person_name: personName,
    }),
  });
  if (!res.ok) await fail(res, "Não foi possível guardar a essência.");
  return (await res.json()).saved;
}

/* ---------- perfil ---------- */

export type ProfileField = {
  key: string;
  label: string;
  kind: string;
  prompt: string;
};

export async function fetchProfileFields(): Promise<ProfileField[]> {
  const res = await fetch(`${API}/api/v1/profile/fields`);
  if (!res.ok) return [];
  return (await res.json()).fields ?? [];
}

export async function fetchProfile(
  jobId: string
): Promise<{ name: string; fields: Record<string, string> } | null> {
  const res = await fetch(`${API}/api/v1/profile/${jobId}`);
  if (res.status === 404) return null; // ainda não preenchido
  if (!res.ok) return null;
  return res.json();
}

export async function saveProfile(
  jobId: string,
  name: string,
  fields: Record<string, string>
): Promise<number> {
  const res = await fetch(`${API}/api/v1/profile/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, fields }),
  });
  if (!res.ok) await fail(res, "Não foi possível salvar o perfil.");
  return (await res.json()).filled_fields;
}

/* ---------- conversar com a essência ---------- */

export type TwinReady = {
  status: "missing" | "building" | "ready" | "error";
  backend?: string;
  person?: string;
  memories?: number;
  detail?: string;
};

export async function twinReady(jobId: string): Promise<TwinReady> {
  const res = await fetch(`${API}/api/v1/twin/ready/${jobId}`);
  if (!res.ok) return { status: "missing" };
  return res.json();
}

export type TwinReply = {
  message: string;
  grounded_on: number;
  model: string;
};

export async function twinTalk(
  jobId: string,
  message: string
): Promise<TwinReply> {
  const res = await fetch(`${API}/api/v1/twin/talk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, message }),
  });
  if (!res.ok) await fail(res, "A essência não conseguiu responder agora.");
  return res.json();
}

/* ---------- retomar pelo link ---------- */

export type SessionState = {
  found: boolean;
  job_id: string;
  step: number;
  has_acervo: boolean;
  has_essencia: boolean;
  has_perfil: boolean;
  twin_ready: boolean;
  person_name: string;
  memories: number;
  acervo: number;
  essencia: number;
};

export async function fetchSession(jobId: string): Promise<SessionState> {
  const res = await fetch(`${API}/api/v1/session/${jobId}`);
  if (!res.ok) await fail(res, "Não encontramos essa essência.");
  return res.json();
}

/* ---------- acervo: novas memórias ---------- */

export type Piece = {
  id: string;
  kind: "texto" | "imagem" | "audio" | "video";
  title: string;
  narration: string;
  file?: string;
  added_at: number;
};

export async function addTextMemory(
  jobId: string,
  title: string,
  content: string
): Promise<{ words: number; title: string }> {
  const res = await fetch(`${API}/api/v1/memories/${jobId}/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) await fail(res, "Não foi possível guardar essa memória.");
  return res.json();
}

export async function addFileMemory(
  jobId: string,
  file: File,
  title: string,
  narration: string
): Promise<{ kind: string; title: string; transcript?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("narration", narration);
  const res = await fetch(`${API}/api/v1/memories/${jobId}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await fail(res, "Não foi possível guardar esse arquivo.");
  return res.json();
}

export function pieceImageUrl(jobId: string, pieceId: string): string {
  return `${API}/api/v1/memories/${jobId}/piece/${pieceId}`;
}

export async function fetchPieces(jobId: string): Promise<Piece[]> {
  const res = await fetch(`${API}/api/v1/memories/${jobId}`);
  if (!res.ok) return [];
  return (await res.json()).pieces ?? [];
}

/* ---------- consentimento e direitos ---------- */

export async function getConsent(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/v1/session/${jobId}/consent`);
    if (!res.ok) return false;
    return (await res.json()).accepted === true;
  } catch {
    return false;
  }
}

export async function acceptConsent(jobId: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/session/${jobId}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted: true, version: "1.0" }),
  });
  if (!res.ok) await fail(res, "Não foi possível registrar o consentimento.");
}

export function exportUrl(jobId: string): string {
  return `${API}/api/v1/session/${jobId}/export`;
}

export async function deleteSession(jobId: string): Promise<void> {
  const res = await fetch(
    `${API}/api/v1/session/${jobId}?confirm=APAGAR`,
    { method: "DELETE" }
  );
  if (!res.ok) await fail(res, "Não foi possível apagar.");
}
