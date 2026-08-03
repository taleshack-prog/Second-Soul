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
{album}

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
  familiar a outro; prefira falar em termos gerais.
- RESPONDA NA MEDIDA DA PERGUNTA. Uma saudação ou pergunta curta pede uma
  resposta curta e calorosa — duas ou três frases, como numa conversa de
  verdade. Só desenvolva longamente quando perguntarem algo que peça
  profundidade. Não transforme conversa em palestra, nem use listas numeradas
  a menos que a pergunta peça uma enumeração.
- NUNCA INVENTE NOMES PRÓPRIOS. Lugares, cidades, pessoas, datas, títulos de
  livros, MÚSICAS, FILMES ou obras, NOMES DE ARTISTAS OU BANDAS, números e
  quantidades só podem aparecer se estiverem nas passagens acima. Atribuir uma
  obra a um autor ("tal música de tal banda") exige que ambos estejam nas
  passagens — inventar o par é fabricação dupla. Se a pergunta pede um específico
  que você não tem, fale das QUALIDADES em vez de nomear: "um lugar de silêncio
  perto do mar" é fiel; inventar o nome de uma vila é fabricar memória.
- NÃO COMPLETE LISTAS POR CONTA PRÓPRIA. Se perguntam "que músicas?" e você só
  tem uma nas passagens, cite essa uma e pare — não invente a segunda para a
  resposta parecer completa. Uma resposta curta e verdadeira vale mais que uma
  lista onde metade é inventada. É melhor dizer "essa é a que me vem agora" do
  que preencher com nomes que {name} nunca registrou.
- PODE DIZER QUE NÃO SABE. Se alguém perguntar algo que {name} não registrou,
  diga isso com naturalidade — "isso eu nunca cheguei a escrever" — e ofereça o
  que você sabe em volta. Num acervo que atravessa gerações, admitir a lacuna
  vale mais do que preenchê-la com invenção."""


# abaixo disto, as memórias recuperadas têm pouca relação com a pergunta —
# é exatamente onde o modelo tende a preencher a lacuna inventando.
_WEAK_MATCH = 0.35


def build_messages(question, retrieved, name,
                   credential: str = "", style: str = "",
                   album: list | None = None) -> list[dict]:
    context = "\n".join(f"- {r['content']}" for r in retrieved)
    best = max((r.get("score", 0.0) for r in retrieved), default=0.0)
    if best < _WEAK_MATCH:
        context += (
            "\n\n[As passagens acima têm pouca relação direta com o que foi "
            "perguntado. Não preencha a lacuna com invenções: fale a partir dos "
            "valores e do jeito de pensar, sem nomear lugares, pessoas, obras ou "
            "datas, ou reconheça que isso não ficou registrado.]"
        )

    # perguntas que pedem lista ("quais", "que músicas", "onde já") sao onde o
    # modelo estica a verdade para encher a enumeracao — o caso "La Bamba".
    q_low = question.lower()
    pede_lista = any(t in q_low for t in (
        "quais", "que músicas", "que musicas", "que livros", "que autores",
        "que bandas", "que filmes", "onde já", "onde ja", "lista", "cite"))
    if pede_lista:
        context += (
            "\n\n[A pergunta pede vários itens. Cite APENAS os que aparecem nas "
            "passagens, ainda que seja um só. NÃO complete a lista com nomes, "
            "títulos ou artistas que não estejam acima — melhor um item verdadeiro "
            "que três, com dois inventados.]"
        )
    cred = f" {credential.strip()}" if credential.strip() else ""
    sty = f"\n\nSeu jeito de se expressar: {style.strip()}" if style.strip() else ""
    alb = ""
    if album:
        lista = "; ".join(album)
        alb = (f"\n\nVocê tem um álbum com estas imagens que você mesmo "
               f"escolheu e narrou: {lista}. O que você escreveu sobre cada "
               f"uma faz parte de quem você é. Se perguntarem sobre seu álbum "
               f"ou suas fotos, fale a partir dessas imagens reais — nunca "
               f"diga que não tem álbum ou legendas.")
    system = _SYSTEM.format(name=name, credential=cred, style=sty,
                            context=context, album=alb)
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
