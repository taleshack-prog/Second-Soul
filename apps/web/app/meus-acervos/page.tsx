"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { me, myArchives, clearToken, type MyArchive } from "@/lib/api";

const PAPEL: Record<string, string> = {
  owner: "Você é o dono",
  guest: "Convidado",
  heir: "Herdeiro",
  executor: "Testamenteiro",
};

export default function MeusAcervosPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nome, setNome] = useState("");
  const [archives, setArchives] = useState<MyArchive[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    me().then((acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      setNome(acc.name || acc.email);
      setReady(true);
      myArchives()
        .then(setArchives)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar.")
        );
    });
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Olá, {nome}</h1>
          <p className="text-muted mt-1">As essências que você acessa.</p>
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

      {archives.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-6 text-center">
          <p className="text-muted">
            Você ainda não tem nenhuma essência vinculada à sua conta.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map((a) => (
            <div
              key={a.job_id}
              className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-ink font-medium truncate">
                  {a.person_name || "(sem nome)"}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {PAPEL[a.role] ?? a.role}
                  {a.status === "dormant" && " · aguardando liberação"}
                </p>
              </div>
              {a.twin_ready && a.status !== "dormant" ? (
                <Link
                  href={`/essencia/${a.job_id}`}
                  className="shrink-0 rounded-lg bg-soul text-base text-sm font-medium px-4 py-2 hover:brightness-110 transition"
                >
                  Conversar
                </Link>
              ) : (
                <span className="shrink-0 text-xs text-muted">
                  {a.status === "dormant" ? "bloqueado" : "em construção"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
