"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  me,
  myArchives,
  startCheckout,
  clearToken,
  type MyArchive,
} from "@/lib/api";

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
  const [planStatus, setPlanStatus] = useState("");
  const [archives, setArchives] = useState<MyArchive[]>([]);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  // carrega conta + acervos; detecta retorno do checkout (?assinatura=ok)
  useEffect(() => {
    const paid =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("assinatura") === "ok";
    setJustPaid(paid);

    me().then((acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      setNome(acc.name || acc.email);
      setPlanStatus(acc.plan_status);
      setReady(true);
      myArchives()
        .then(setArchives)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar.")
        );
    });
  }, [router]);

  // acabou de pagar mas o webhook pode demorar 1-2s: confirma o plano ativo.
  useEffect(() => {
    if (!justPaid || planStatus === "active") return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const acc = await me();
      if (acc?.plan_status === "active") {
        setPlanStatus("active");
        clearInterval(timer);
      } else if (tries >= 6) {
        clearInterval(timer);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [justPaid, planStatus]);

  async function assinar(plan: "premium_month" | "premium_year" | "heranca") {
    setError("");
    setPaying(plan);
    try {
      await startCheckout(plan); // redireciona para o Stripe
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
      setPaying("");
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  const temAcervo = archives.length > 0;
  const planoAtivo = planStatus === "active";

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

      {/* 1) já tem acervos vinculados: lista */}
      {temAcervo && (
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
              ) : a.role === "owner" && a.status !== "dormant" ? (
                <Link
                  href={`/s/${a.job_id}`}
                  className="shrink-0 rounded-lg border border-line text-ink text-sm font-medium px-4 py-2 hover:border-soul transition"
                >
                  Continuar
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

      {/* 2) sem acervo, plano ativo (ou acabou de pagar): criar a essência */}
      {!temAcervo && (planoAtivo || justPaid) && (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          {planoAtivo ? (
            <>
              <h2 className="font-display text-2xl text-ink">
                Sua assinatura está ativa.
              </h2>
              <p className="text-muted mt-2 mb-6">
                Agora dê o primeiro passo: construa a sua essência.
              </p>
              <Link
                href="/criar"
                className="inline-block rounded-xl bg-soul text-base font-medium px-6 py-3 hover:brightness-110 transition"
              >
                Criar minha essência
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl text-ink">
                Confirmando seu pagamento…
              </h2>
              <p className="text-muted mt-2">
                Isso leva só alguns segundos. Assim que confirmar, o botão para
                criar sua essência aparece aqui.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 text-sm text-soul underline underline-offset-4"
              >
                Atualizar agora
              </button>
            </>
          )}
        </div>
      )}

      {/* 3) sem acervo e sem plano: escolher um plano (sem freemium) */}
      {!temAcervo && !planoAtivo && !justPaid && (
        <div>
          <p className="text-muted mb-5">
            Você ainda não tem uma essência. Escolha um plano para começar a
            guardar a sua.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Premium */}
            <div className="bg-surface border border-line rounded-2xl p-6 flex flex-col">
              <h3 className="font-display text-xl text-ink">Premium</h3>
              <p className="text-sm text-muted mt-1 mb-4">
                Multimodal, voz, compartilhamento e herdeiros. Os herdeiros
                seguem com acesso enquanto a assinatura é mantida.
              </p>
              <div className="mt-auto space-y-2">
                <button
                  disabled={!!paying}
                  onClick={() => assinar("premium_month")}
                  className="w-full rounded-xl bg-soul text-base font-medium py-3 transition hover:brightness-110 disabled:opacity-50"
                >
                  {paying === "premium_month" ? "Abrindo…" : "R$ 29/mês"}
                </button>
                <button
                  disabled={!!paying}
                  onClick={() => assinar("premium_year")}
                  className="w-full rounded-xl border border-line text-ink font-medium py-3 transition hover:border-soul disabled:opacity-50"
                >
                  {paying === "premium_year" ? "Abrindo…" : "R$ 330/ano"}
                </button>
              </div>
            </div>

            {/* Herança */}
            <div className="bg-surface border border-soul/40 rounded-2xl p-6 flex flex-col">
              <h3 className="font-display text-xl text-ink">Herança</h3>
              <p className="text-sm text-muted mt-1 mb-4">
                Pagamento único. Preservação perpétua, sem mensalidade, com
                suporte à sucessão digital.
              </p>
              <div className="mt-auto">
                <button
                  disabled={!!paying}
                  onClick={() => assinar("heranca")}
                  className="w-full rounded-xl bg-soul text-base font-medium py-3 transition hover:brightness-110 disabled:opacity-50"
                >
                  {paying === "heranca" ? "Abrindo…" : "R$ 6.780 — único"}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted/70 mt-4 text-center">
            Pagamento seguro via Stripe. Você pode cancelar quando quiser.
          </p>
        </div>
      )}
    </main>
  );
}
