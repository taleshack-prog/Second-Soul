"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me, myArchives } from "@/lib/api";
import OnboardingWizard from "@/components/OnboardingWizard";

// Criar/editar a essência. Exige login e plano ativo (sem freemium).
// O admin passa sempre — é por aqui que ele monta a essência de outra pessoa
// (caso legado/herdeiro), que depois vincula no painel.
export default function Page() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    me().then(async (acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      if (!acc.is_admin && acc.plan_status !== "active") {
        // sem plano: manda escolher um (o funil vive em /meus-acervos)
        router.replace("/meus-acervos");
        return;
      }
      if (!acc.is_admin) {
        // já é dono de um acervo: volta a escrever nele, não cria outro.
        // Com mais de um (duplicata), vai para o primeiro — limpeza é manual.
        try {
          const owned = (await myArchives()).find((a) => a.role === "owner");
          if (owned) {
            router.replace(`/s/${owned.job_id}`);
            return;
          }
        } catch {
          /* falhou ao listar: segue para criar, como antes */
        }
      }
      setOk(true);
    });
  }, [router]);

  if (!ok) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  return <OnboardingWizard />;
}
