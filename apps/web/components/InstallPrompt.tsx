"use client";

import { useEffect, useState } from "react";

// Nudge discreto e dispensável para instalar o app.
// Android/desktop: usa o beforeinstallprompt (botão "Instalar").
// iOS Safari: mostra a instrução (lá a instalação é manual, pelo Compartilhar).
type BIPEvent = Event & { prompt: () => void; userChoice: Promise<unknown> };

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("ss-install-dismiss") === "1";
    } catch {
      /* ignore */
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", () => setHidden(true));

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (hidden || (!deferred && !iosHint)) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem("ss-install-dismiss", "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setHidden(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-xl backdrop-blur">
        <img src="/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          {deferred ? (
            <p className="text-sm text-ink">Instale o Second Soul no seu celular.</p>
          ) : (
            <p className="text-sm text-ink">
              Toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.
            </p>
          )}
        </div>
        {deferred && (
          <button
            onClick={install}
            className="shrink-0 rounded-full bg-soul px-4 py-1.5 text-sm font-medium text-[#241703] transition hover:brightness-110"
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 text-muted transition hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
