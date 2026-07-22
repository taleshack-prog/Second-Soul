# Arquitetura & Decisões

Registro das correções feitas sobre a especificação original (`Second-Soul-Schema`),
com base em revisão de código e pesquisa (jul/2026).

## 1. Groq não faz fine-tuning LoRA (correção de arquitetura)

A spec descrevia "fine-tuning LoRA via Groq" como o coração e a decisão
Go/No-Go. **Isso não é viável no caminho free/dev:**

- A Groq **não treina** LoRA. Você gera o adapter externamente (RunPod, Lambda,
  Vast.ai ou GPU local com PEFT/Unsloth) sobre a *versão exata* de um base model
  suportado.
- **Hospedar** o adapter na Groq é **enterprise-tier, por requisição, closed beta**.

**Decisão:** o MVP roda com **prompt-steering (system prompt por modo) + RAG
(contexto recuperado das memórias)**. Isso é o que o próprio `inference_engine`
da spec já fazia de fato. A validação da sua mãe **não precisa de LoRA** —
precisa de extração de personalidade + reconhecimento. LoRA vira otimização de
*fidelidade* numa fase posterior (Sprint 5+), como caminho externo → upload.

## 2. Modelos Groq mudaram

- `llama3-70b-8192` (hardcoded na spec) foi **descomissionado** → retorna HTTP 400.
- `llama-3.3-70b-versatile` e `llama-3.1-8b-instant` entraram em **depreciação**
  (anúncio jun/2026).
- **Default atual:** `openai/gpt-oss-120b` (open-weight, produção). Configurável
  via `GROQ_MODEL` no `.env`. Sempre confira a página de modelos da Groq.

## 3. Bugs de código corrigidos

| Local | Problema | Correção |
|-------|----------|----------|
| `main.py` | `app.mount("/ws", sio_app)` — `sio_app` nunca definido, Socket.IO fora das deps | removido; WebSocket vira rota FastAPI nativa depois |
| `main.py` | `settings.FRONTEND_URL` referenciado, não existia em `config.py` | adicionado em `config.py` |
| `twin.py` (ws) | `verify_token`/`db_session` usados sem import/definição | endpoint WS adiado para Sprint 2 |
| `NormalizedItem` | campo sem default (`checksum`) após campos com default → `TypeError` | reordenado + `field(default_factory=...)` |
| `NormalizedItem` | `imported_at = datetime.utcnow()` avaliado 1x na classe | `default_factory` |
| imports | `from packages.twin_engine...` — Python não importa de `twin-engine` (hífen) | pacotes com nome válido (`second_soul_importer`) instaláveis via `pip -e` |

## 4. Estrutura de pacotes (monorepo Python)

A spec usava `from packages.twin_engine...`, que não resolve (hífen no diretório
e sem instalação). Aqui cada pacote Python é **instalável** (`pyproject.toml` +
`pip install -e`), então os imports funcionam de qualquer app. Isso troca a
mágica de `sys.path` por dependências explícitas.

## 5. Fluxo de dados (Sprint 1)

```
export ChatGPT (.zip/.json)
        │
        ▼
  ChatGPTParser  ──►  NormalizedItem[]
        │
        ▼
  NoiseReducer → Deduplicator → PIIScanner   (LGPD: strict/balanced/minimal)
        │
        ▼
  JSONL  ──►  (Sprint 2) embeddings + pgvector  ──►  RAG no /twin/chat
```

## 6. Privacidade (não-negociável)

Ingestão universal = risco real de dados sensíveis. O `PIIScanner` roda em toda
importação, com nível escolhido **antes** da ingestão. Memórias reais nunca são
commitadas (`.gitignore` bloqueia `*.jsonl`, `exports/`, `uploads/`).

**Consentimento:** para dados de terceiros (ex.: sua mãe, 84), o consentimento
informado da titular é pré-requisito de produto, não só de compliance — quem é
retratado pelo gêmeo precisa entender e autorizar o uso dos próprios dados.
