"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me, myArchives } from "@/lib/api";
import OnboardingWizard from "@/components/OnboardingWizard";

// Tela de escrita: só o dono abre. O backend é a trava de verdade (rotas de
// escrita exigem dono); aqui só evitamos mostrar a escrita a quem não pode.
//   sem login            -> /entrar
//   admin                -> wizard (passa sempre, como no backend)
//   logado, não é dono   -> /essencia/<jobId> (leitura e conversa, públicas)
//   dono                 -> wizard, como antes
export default function ResumePage({
  params,
}: {
  params: { jobId: string };
}) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const jobId = params.jobId;

  useEffect(() => {
    me().then(async (acc) => {
      if (!acc) {
        router.replace("/entrar");
        return;
      }
      if (acc.is_admin) {
        // admin passa sempre, como no backend
        setOk(true);
        return;
      }
      try {
        const archives = await myArchives();
        const isOwner = archives.some(
          (a) => a.job_id === jobId && a.role === "owner"
        );
        if (!isOwner) {
          router.replace(`/essencia/${jobId}`);
          return;
        }
      } catch {
        router.replace(`/essencia/${jobId}`);
        return;
      }
      setOk(true);
    });
  }, [router, jobId]);

  if (!ok) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  return <OnboardingWizard resumeJobId={jobId} />;
}
