"""Serviço do Gêmeo Digital — prompt-steering + RAG.

NOTA DE ARQUITETURA (correção da spec):
A spec original descrevia "fine-tuning LoRA via Groq". Isso não é viável no
caminho free/dev: a Groq NÃO treina LoRA — você gera o adapter externamente
(RunPod/Lambda/GPU local) e, para HOSPEDAR na Groq, precisa ser enterprise,
por requisição, em closed beta. Portanto o MVP (e a validação da sua mãe) roda
com PROMPT-STEERING (system prompt por modo) + RAG (contexto recuperado das
memórias importadas). LoRA é uma otimização de FIDELIDADE para depois — não é
pré-requisito para provar o conceito.

Este serviço é stateless em relação ao provider: se GROQ_API_KEY não estiver
setada, ele responde em modo "eco" para a API subir e ser testável sem chave.
"""

from __future__ import annotations

import time
from typing import Any

from app.core.config import settings

_SYSTEM_PROMPTS: dict[str, str] = {
    "advice": (
        "Você é {name}, dando um conselho a alguém que você ama. Use o tom e o "
        "vocabulário de {name}. Baseie-se nos valores: {values}. Seja autêntico."
    ),
    "memory": (
        "Você é {name} contando uma história da sua vida. Use a cadência e as "
        "expressões de {name}. Detalhes sensoriais. Deve soar real e pessoal."
    ),
    "decision": (
        "Você é {name} diante de uma decisão importante. Aplique o padrão de "
        "decisão de {name} e explique o raciocínio por trás da escolha."
    ),
    "free": (
        "Você é {name}. Responda naturalmente, como {name} responderia, "
        "mantendo personalidade, humor e perspectiva consistentes."
    ),
}


class TwinService:
    def __init__(self, profile: dict[str, Any] | None = None):
        self.profile = profile or {"name": "a pessoa", "values": "autenticidade"}

    async def chat(
        self, message: str, mode: str = "free", context: list[str] | None = None
    ) -> dict[str, Any]:
        start = time.time()
        context = context or []

        system = _SYSTEM_PROMPTS.get(mode, _SYSTEM_PROMPTS["free"]).format(
            name=self.profile.get("name", "a pessoa"),
            values=self.profile.get("values", "autenticidade"),
        )

        if not settings.GROQ_API_KEY:
            text = (
                "[modo eco — sem GROQ_API_KEY] "
                f"Como {self.profile.get('name')} eu diria: '{message}'"
            )
            return self._result(text, mode, 0.0, start, bool(context), model="echo")

        text = await self._call_groq(system, message, context, mode)
        return self._result(text, mode, 0.85, start, bool(context), model=settings.GROQ_MODEL)

    async def _call_groq(
        self, system: str, message: str, context: list[str], mode: str
    ) -> str:
        # Import tardio: a API sobe mesmo sem o SDK instalado em dev.
        from groq import AsyncGroq

        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        messages = [{"role": "system", "content": system}]
        if context:
            joined = "\n".join(context[-5:])
            messages.append(
                {"role": "system", "content": f"Memórias relevantes:\n{joined}"}
            )
        messages.append({"role": "user", "content": message})

        resp = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=0.4 if mode == "decision" else 0.7,
            max_tokens=1024,
        )
        return resp.choices[0].message.content or ""

    @staticmethod
    def _result(text, mode, conf, start, grounded, model) -> dict[str, Any]:
        return {
            "message": text,
            "mode": mode,
            "confidence": conf,
            "processing_time_ms": round((time.time() - start) * 1000, 2),
            "model": model,
            "grounded": grounded,
        }
