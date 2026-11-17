"use client";

import { useEffect } from "react";

// Registra o service worker (necessário para o app ser instalável).
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sem SW o site segue normal, só não instala no Android */
      });
    }
  }, []);
  return null;
}
