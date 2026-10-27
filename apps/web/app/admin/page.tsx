"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  me,
  adminArchives,
  adminAssign,
  adminUnlink,
  clearToken,
  type AdminArchive,
} from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [archives, setArchives] = useState<AdminArchive[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setArchives(await adminArchives());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    me().then((acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      if (!acc.is_admin) {
        router.replace("/meus-acervos");
        return;
      }
      setReady(true);
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  const semDono = archives.filter((a) => !a.owner_email).length;

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Painel</h1>
          <p className="text-muted mt-1">
            {archives.length} acervos · {semDono} sem dono
          </p>
        </div>
        <button
          onClick={() => {
            clearToken();
            router.replace("/entrar");
          }}
          className="text-sm text-muted hover:text-ink transition"
        >
          Sair
        </button>
      </header>

      {error && (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 mb-6">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {archives.map((a) => (
          <ArchiveRow key={a.job_id} archive={a} onChange={load} />
        ))}
      </div>
    </main>
  );
}

function ArchiveRow({
  archive,
  onChange,
}: {
  archive: AdminArchive;
  onChange: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function assign() {
    if (!email.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await adminAssign(archive.job_id, email.trim().toLowerCase());
      setEmail("");
      onChange();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!archive.owner_email) return;
    setBusy(true);
    setMsg("");
    try {
      await adminUnlink(archive.job_id, archive.owner_email);
      onChange();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink font-medium truncate">
            {archive.person_name || "(sem nome)"}
          </p>
          <p className="text-xs text-muted mt-0.5 font-mono truncate">
            /s/{archive.job_id}
          </p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-muted">passo {archive.step}</span>
            {archive.twin_ready ? (
              <span className="text-soul">· gêmeo pronto</span>
            ) : (
              <span className="text-muted">· em construção</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {archive.owner_email ? (
            <>
              <p className="text-xs text-muted">dono</p>
              <p className="text-sm text-ink">{archive.owner_email}</p>
              <button
                onClick={remove}
                disabled={busy}
                className="text-xs text-muted hover:text-red-300 transition mt-1 disabled:opacity-50"
              >
                remover
              </button>
            </>
          ) : (
            <span className="text-xs text-soul/80 border border-soul/30 rounded-full px-2 py-1">
              sem dono
            </span>
          )}
        </div>
      </div>

      {!archive.owner_email && (
        <div className="flex gap-2 mt-3">
          <input
            className="flex-1 rounded-lg bg-surface2 border border-line px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-soul outline-none"
            type="email"
            placeholder="e-mail da conta dona"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && assign()}
          />
          <button
            onClick={assign}
            disabled={busy}
            className="rounded-lg bg-soul text-base text-sm font-medium px-4 py-2 hover:brightness-110 transition disabled:opacity-50"
          >
            {busy ? "…" : "Atribuir"}
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-red-300 mt-2">{msg}</p>}
    </div>
  );
}
