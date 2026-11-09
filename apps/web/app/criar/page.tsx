"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me } from "@/lib/api";
import OnboardingWizard from "@/components/OnboardingWizard";

// Criar/editar a essência. Exige login e plano ativo (sem freemium).
// O admin passa sempre — é por aqui que ele monta a essência de outra pessoa
// (caso legado/herdeiro), que depois vincula no painel.
export default function Page() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    me().then((acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      if (!acc.is_admin && acc.plan_status !== "active") {
        // sem plano: manda escolher um (o funil vive em /meus-acervos)
        router.replace("/meus-acervos");
        return;
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
