import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Twilight — o "extrafísico": profundidade, consciência, noite
        base: "#0C1024",
        surface: "#151A33",
        surface2: "#1E2444",
        line: "#2A3157",
        ink: "#ECEDF6",
        muted: "#9AA0C4",
        // Soul-light — a vela da memória (elemento-assinatura)
        soul: "#E8B060",
        soulglow: "rgba(232,176,96,0.16)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        vessel: "0 0 0 1px rgba(232,176,96,0.25), 0 20px 60px -30px rgba(232,176,96,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
