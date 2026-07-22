"""CLI do gêmeo digital.

Criar um perfil em branco (a pessoa preenche só o que quiser):
    ss-twin profile-template --out perfil.json

Indexar memórias + perfil (perfil pesa mais na recuperação):
    ss-twin index mae_reflexao.jsonl --profile perfil.json --backend sbert

Recuperação pura (local, sem LLM):
    ss-twin ask "..." --index .twin_index

Conversa (recuperação + LLM, já com credencial e tom do perfil):
    export GROQ_API_KEY=...
    ss-twin chat "..." --index .twin_index --name "minha mãe"
"""
from __future__ import annotations

import argparse
import json
import sys

from .index import TwinIndex
from .generate import generate
from . import profile as prof


def _load_rows(path, min_words):
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if len((obj.get("content") or "").split()) >= min_words:
                rows.append(obj)
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(description="Second Soul — gemeo digital")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pt = sub.add_parser("profile-template", help="cria um perfil em branco")
    pt.add_argument("--out", default="perfil.json")

    pi = sub.add_parser("index", help="constrói o índice (memórias + perfil)")
    pi.add_argument("jsonl")
    pi.add_argument("--profile", default=None, help="perfil.json (opcional)")
    pi.add_argument("--backend", default="tfidf", choices=["tfidf", "sbert"])
    pi.add_argument("--out", default=".twin_index")
    pi.add_argument("--min-words", type=int, default=3)

    pa = sub.add_parser("ask", help="recuperação pura (local, sem LLM)")
    pa.add_argument("question")
    pa.add_argument("--index", default=".twin_index")
    pa.add_argument("--k", type=int, default=6)

    pc = sub.add_parser("chat", help="recuperação + LLM (fala como ela)")
    pc.add_argument("question")
    pc.add_argument("--index", default=".twin_index")
    pc.add_argument("--name", default="a pessoa")
    pc.add_argument("--k", type=int, default=6)
    pc.add_argument("--provider", default="groq", choices=["groq", "ollama"])

    args = ap.parse_args(argv)

    if args.cmd == "profile-template":
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(prof.template(), fh, ensure_ascii=False, indent=2)
        print(f"Perfil em branco criado em {args.out}. Campos sugeridos (todos opcionais):")
        for f in prof.FIELDS:
            print(f"  - {f['key']}: {f['prompt']}")
        return 0

    if args.cmd == "index":
        rows = _load_rows(args.jsonl, args.min_words)
        summary = {}
        if args.profile:
            profile = prof.load_profile(args.profile)
            p_items = prof.profile_to_items(profile)
            rows = p_items + rows          # perfil primeiro (e com weight>1)
            summary = prof.summaries(profile)
            print(f"Perfil: +{len(p_items)} itens (peso {prof.PROFILE_WEIGHT}), "
                  f"credencial={'sim' if summary.get('credential') else 'não'}, "
                  f"tom={'sim' if summary.get('style') else 'não'}.")
        TwinIndex(backend=args.backend).build(rows, profile=summary).save(args.out)
        print(f"Indice com {len(rows)} itens salvo em {args.out} (backend={args.backend}).")
        return 0

    if args.cmd == "ask":
        idx = TwinIndex.load(args.index)
        hits = idx.query(args.question, k=args.k)
        print(f'\nMemorias mais proximas de: "{args.question}"\n')
        for h in hits:
            tag = "[PERFIL]" if h.get("source") == "profile" else ""
            print(f"  [{h['score']:.3f}] {tag} {h['content'][:150]}")
            if h.get("file_name"):
                print(f"          -> {h['file_name']}")
        print()
        return 0

    if args.cmd == "chat":
        idx = TwinIndex.load(args.index)
        hits = idx.query(args.question, k=args.k)
        p = idx.profile or {}
        try:
            res = generate(args.question, hits, name=args.name, provider=args.provider,
                           credential=p.get("credential", ""), style=p.get("style", ""))
        except RuntimeError as e:
            print(f"\n[!] {e}\n")
            return 1
        print(f"\n{args.name} responde (ancorado em {res['grounded_on']} memorias):\n")
        print(res["text"])
        print()
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
