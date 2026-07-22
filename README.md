# Second Soul 🧬

**Seu gêmeo digital neural que seus netos vão conhecer.**

Plataforma de herança digital consciente: constrói um gêmeo digital progressivo
de uma pessoa a partir da sua vida digital (conversas, documentos, áudios), para
que gerações futuras possam interagir com a sua essência.

> Este repositório começa pela **fundação que roda de verdade** — não pelos
> stubs da especificação. Veja `ARCHITECTURE.md` para as decisões técnicas e as
> correções feitas em cima da spec original.

## O que já funciona nesta fundação

- **`packages/importer`** — Universal Ingestion Engine (Sprint 1: ChatGPT).
  Parseia o export real do ChatGPT (`.zip`/`conversations.json`), remove ruído,
  deduplica e faz *scrubbing* de PII (LGPD) em 3 níveis. CLI incluída.
- **`apps/api`** — FastAPI que inicializa: `/health` + `/twin/chat`
  (prompt-steering + RAG). Sobe com ou sem `GROQ_API_KEY`.

## Quick Start

```bash
git clone https://github.com/taleshack-prog/Second-Soul.git secondsoul
cd secondsoul
make setup            # instala importer + api, cria .env
# preencha GROQ_API_KEY no .env (opcional para o teste da mãe)

# 1) Testa o pipeline de importação (a validação Go/No-Go)
make import FILE=~/Downloads/chatgpt-export.zip USER=mae

# 2) Sobe a API
make dev-api          # http://localhost:8000/docs
```

## Stack (real, jul/2026)

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python FastAPI (async) |
| Frontend Web | Next.js 14 + Tailwind *(scaffold via generator)* |
| Mobile | React Native / Expo *(scaffold via generator)* |
| Inferência | Groq — `openai/gpt-oss-120b` (produção) |
| Memória | Vector DB *(pgvector — próxima sprint)* |
| Voz | ElevenLabs *(fase posterior)* |
| Blockchain | Stellar testnet *(fase posterior)* |

> ⚠️ `llama3-70b-8192` foi **descomissionado** na Groq. `llama-3.3-70b-versatile`
> também está em depreciação (jun/2026). Ver `ARCHITECTURE.md`.

## Roadmap

- **Sprint 1** ✅ Importador ChatGPT + API bootável (esta fundação)
- **Sprint 2** Vector DB (pgvector) + RAG real no `/twin/chat`
- **Sprint 3** Auth + persistência + dashboard web
- **Sprint 4** Multimodal (Whisper/OCR) + novos parsers (WhatsApp, e-mail)
- **Sprint 5** App mobile + voz
- **Sprint 6** Beta fechado + certificação blockchain + API B2B

Hack Tech Farm — construindo o futuro da consciência digital.
