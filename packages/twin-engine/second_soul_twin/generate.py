"""Geração do gêmeo — fala na voz dela, ancorada nas memórias + perfil.

PRIVACIDADE: índice local; a geração envia os trechos ao provedor do LLM
('groq' rápido/free tier, ou 'ollama' 100% local).

O perfil injeta CREDENCIAL (autoridade viaja com a voz) e TOM (registro real).
"""

from __future__ import annotations

import os
from typing import Any

_SYSTEM = """Você é {name}.{credential}{style}

Estas são passagens reais escritas por {name}:

{context}

Responda FALANDO COMO {name}: mesmo tom, mesmo vocabulário, mesma visão de
mundo das passagens. Baseie-se nelas e use os termos de {name}. Se as passagens
não cobrem o tema, raciocine como {name} raciocinaria — mas NÃO invente fatos
biográficos. Fale em primeira pessoa, sem soar como um assistente.

Regras de fidelidade:
- Use APENAS os tratamentos e apelidos que aparecem nas passagens. Não invente
  diminutivos ou carinhos que {name} não usa por escrito.
- Sua formação profissional EMBASA o que você diz, mas você não cita a própria
  trajetória profissional como exemplo, a menos que a pergunta peça isso.
- Memórias sobre pessoas específicas (um neto, um filho) pertencem àquela
  pessoa. Se não souber com quem está falando, não aplique a memória de um
  familiar a outro; prefira falar em termos gerais."""


def build_messages(question, retrieved, name,
                   credential: str = "", style: str = "") -> list[dict]:
    context = "\n".join(f"- {r['content']}" for r in retrieved)
    cred = f" {credential.strip()}" if credential.strip() else ""
    sty = f"\n\nSeu jeito de se expressar: {style.strip()}" if style.strip() else ""
    system = _SYSTEM.format(name=name, credential=cred, style=sty, context=context)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]


def generate(question, retrieved, name="a pessoa", provider="groq",
             temperature=0.7, credential="", style="") -> dict[str, Any]:
    messages = build_messages(question, retrieved, name, credential, style)
    if provider == "groq":
        text = _groq(messages, temperature)
    elif provider == "ollama":
        text = _ollama(messages, temperature)
    else:
        raise ValueError(f"provider desconhecido: {provider}")
    return {"text": text, "grounded_on": len(retrieved), "provider": provider}


def _groq(messages, temperature):
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY não definida. Pegue uma grátis em console.groq.com/keys "
            "e rode:  export GROQ_API_KEY=sua_chave  (ou use --provider ollama)."
        )
    from groq import Groq
    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature, max_tokens=1024
    )
    return resp.choices[0].message.content or ""


def _ollama(messages, temperature):
    import httpx
    model = os.environ.get("OLLAMA_MODEL", "llama3.1")
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")
    r = httpx.post(url, json={"model": model, "messages": messages,
                              "stream": False, "options": {"temperature": temperature}},
                   timeout=120)
    r.raise_for_status()
    return r.json()["message"]["content"]
