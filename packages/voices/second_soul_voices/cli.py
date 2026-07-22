"""CLI de vozes: clustering (descobrir pessoas) OU filtro por tema (isolar uma).

Descobrir vozes (quando NÃO se conhece a conta):
    ss-voices teste.jsonl

Isolar uma pessoa por tema (quando SE conhece — recomendado):
    ss-voices teste.jsonl --seed "conscienciologia consciência ..." \
        --threshold 0.05 --out mae.jsonl
"""
from __future__ import annotations

import argparse
import json
import sys

from .separate import separate
from .topicfilter import filter_by_seed

# semente padrão pro caso conscienciologia (edite à vontade)
SEED_CONSCIENCIOLOGIA = (
    "conscienciologia consciência consciex consciencial projeção paracérebro "
    "ginossoma neurodivergência neurodivergente paradigma existências soma "
    "cérebro autismo TDAH holobiografia evolução serialidade"
)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Second Soul — vozes")
    ap.add_argument("jsonl")
    ap.add_argument("--backend", default="tfidf", choices=["tfidf", "sbert"])
    ap.add_argument("--min-words", type=int, default=4)
    # modo filtro
    ap.add_argument("--seed", nargs="?", const=SEED_CONSCIENCIOLOGIA, default=None,
                    help="termos do domínio; sem valor usa a semente de conscienciologia")
    ap.add_argument("--threshold", type=float, default=None)
    ap.add_argument("--top", type=int, default=None)
    ap.add_argument("--out", default=None, help="grava as falas mantidas em JSONL")
    ap.add_argument("--distill", action="store_true",
                    help="destila reflexão (descarta comando/prosa de livro)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if args.distill:
        return _run_distill(args)
    if args.seed is not None:
        return _run_filter(args)
    return _run_cluster(args)


def _run_distill(args) -> int:
    from .distill import distill

    tau = args.threshold if args.threshold is not None else 1.0
    res = distill(args.jsonl, threshold=tau, min_words=args.min_words)
    if res["status"] != "success":
        print(f"[{res['status']}]"); return 1
    rows = res.pop("kept_rows")

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"\n  {res['kept']} de {res['total_user_messages']} falas mantidas "
              f"(corte de reflexão >= {res['threshold']})")
        print("  distribuição (corte -> quantas acima):")
        for t, c in res["score_distribution"].items():
            print(f"    >= {t}: {c}")
        print("\n  TOP reflexões (o que o gêmeo vai aprender):")
        for s in res["top_reflections"]:
            print(f"    · {s[:110]}")
        print("\n  descartadas (comando/prosa de livro):")
        for s in res["dropped_examples"]:
            print(f"    · {s[:110]}")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n  {len(rows)} reflexões destiladas gravadas em {args.out}")
    return 0


def _run_filter(args) -> int:
    res = filter_by_seed(
        args.jsonl, args.seed, backend=args.backend,
        threshold=args.threshold, top_k=args.top, min_words=args.min_words,
    )
    if res["status"] != "success":
        print(f"[{res['status']}] {res.get('reason','')}"); return 1
    rows = res.pop("kept_rows")

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"\n  {res['kept']} de {res['total_user_messages']} falas mantidas "
              f"({res['criterion']}) · backend={res['backend']}")
        print("  distribuição de score (corte -> quantas falas acima):")
        for t, c in res["score_distribution"].items():
            print(f"    >= {t}: {c}")
        print("\n  amostras mantidas:")
        for s in res["samples_kept"]:
            print(f"    · {s[:110]}")
        print("\n  borderline (logo abaixo do corte — ajuste se estiver perdendo coisa dela):")
        for b in res["borderline_excluded"]:
            print(f"    · {b[:110]}")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n  {len(rows)} falas gravadas em {args.out}")
    return 0


def _run_cluster(args) -> int:
    res = separate(args.jsonl, backend=args.backend, min_words=args.min_words)
    if res["status"] != "success":
        print(f"[{res['status']}] {res.get('reason','')}"); return 1
    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2)); return 0
    print(f"\n  {res['analyzed']} falas · {res['voices_found']} voz(es) · "
          f"{res['ambiguous_low_confidence']} ambíguas")
    for v in res["voices"]:
        st = v["style"]
        print(f"\n  ● VOZ {v['voice_id']} — {v['size']} falas ({v['share']}%) · "
              f"{v['confident_size']} confiáveis")
        print(f"    temas: {', '.join(v['top_terms'])}")
        print(f"    estilo: frase~{st['avg_sentence_len']} · gíria {st['slang_rate']} · "
              f"código {st['code_score']}")
        for s in v["samples"][:3]:
            print(f"      · {s[:110]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
