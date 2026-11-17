import type { MetadataRoute } from "next";

// Manifesto PWA — torna o secondsoul.com.br instalável no celular
// ("Instalar app" no Android, "Adicionar à Tela de Início" no iOS).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Second Soul",
    short_name: "Second Soul",
    description:
      "Preserve a essência de quem você ama num gêmeo digital — memórias, voz e jeito de pensar.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#0b0811",
    theme_color: "#0b0811",
    categories: ["lifestyle", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
