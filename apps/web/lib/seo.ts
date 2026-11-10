// Fonte única de verdade para SEO/AEO: URL canônica e o FAQ que alimenta
// tanto a seção visível quanto o bloco JSON-LD (FAQPage).

export const SITE_URL = "https://www.secondsoul.com.br";

export type Faq = { q: string; a: string };

export const FAQ: Faq[] = [
  {
    q: "O que é o Second Soul?",
    a: "O Second Soul preserva a essência de uma pessoa — suas memórias, sua voz e seu jeito de pensar — num gêmeo digital com quem a família pode conversar, hoje e pelas próximas gerações.",
  },
  {
    q: "O gêmeo digital inventa coisas?",
    a: "Não. Ele responde apenas com o que a pessoa viveu e contou, e distingue o que é memória real do que é ficção. É isso que o separa de um chatbot comum.",
  },
  {
    q: "Quanto custa o Second Soul?",
    a: "O plano Premium custa R$ 29 por mês (ou R$ 330 por ano) e inclui multimodal, voz, compartilhamento e herdeiros. O plano Herança custa R$ 6.780 em pagamento único, com preservação perpétua.",
  },
  {
    q: "Meus dados ficam seguros e privados?",
    a: "Sim. Tudo é criptografado, você decide quem acessa e quem herda, e pode exportar todas as memórias ou apagar tudo quando quiser, conforme a LGPD.",
  },
  {
    q: "Como funciona, na prática?",
    a: "Em três passos: você conta suas memórias (escrevendo ou falando), o gêmeo aprende o seu jeito, e a sua família conversa com ele — agora e sempre.",
  },
  {
    q: "Posso compartilhar com a minha família?",
    a: "Sim, em todos os planos. Você convida pessoas em vida e designa herdeiros, que recebem acesso conforme você definir.",
  },
];
